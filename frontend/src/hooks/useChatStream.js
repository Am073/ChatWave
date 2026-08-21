import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useChatStream — WebSocket-backed streaming chat hook.
 *
 * The v3 backend exposes a WebSocket at `${API_BASE}/api/chat/ws` that takes
 * auth from the same access_token cookie used by the HTTP routes. The wire
 * protocol is documented in backend_py/app/api/routes/chat.py.
 *
 * Behavior:
 *  - Connects on mount, reconnects with exponential backoff on failure.
 *  - sendMessage() emits a `question` frame; the server replies with
 *    `status`, `sources`, `token`, and `final` frames.
 *  - `connected` reflects the live socket state for the UI.
 *  - `cancel()` sends a `cancel` frame; the server emits a `status` frame
 *    with stage=cancelled.
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_MS = 1000;

function buildWsUrl() {
  if (!API_BASE) {
    return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/chat/ws`;
  }
  const base = API_BASE.replace(/^http/, 'ws');
  return `${base}/api/chat/ws`;
}

export function useChatStream(userId, collegeName) {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [connected, setConnected] = useState(false);
  const [reconnectFailed, setReconnectFailed] = useState(false);
  const wsRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const pingTimerRef = useRef(null);
  const botIdMapRef = useRef(new Map());
  const connectRef = useRef(null);

  // reconnect logic — does NOT depend on `connect`, calls it via ref.
  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setReconnectFailed(true);
      return;
    }
    const attempt = reconnectAttemptRef.current;
    const delay = BASE_RECONNECT_MS * Math.pow(2, attempt);
    reconnectTimerRef.current = setTimeout(() => {
      reconnectAttemptRef.current += 1;
      if (connectRef.current) connectRef.current();
    }, delay);
  }, []);

  // Build a WebSocket and wire up lifecycle handlers.
  const connect = useCallback(() => {
    if (!userId) return;
    try {
      const ws = new WebSocket(buildWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setReconnectFailed(false);
        reconnectAttemptRef.current = 0;
        // Heartbeat every 30s to keep the connection open.
        pingTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        applyEvent(msg, setMessages, setIsTyping, botIdMapRef);
      };

      ws.onerror = () => {
        setConnected(false);
      };

      ws.onclose = () => {
        setConnected(false);
        if (pingTimerRef.current) {
          clearInterval(pingTimerRef.current);
          pingTimerRef.current = null;
        }
        if (userId) {
          scheduleReconnect();
        }
      };
    } catch (err) {
      console.error('[WS] connect error:', err);
      scheduleReconnect();
    }
  }, [userId, scheduleReconnect]);
  // Keep connectRef in sync so scheduleReconnect can call connect without a dep cycle.
  useEffect(() => { connectRef.current = connect; });

  useEffect(() => {
    if (!userId) {
      setConnected(false);
      return undefined;
    }
    connect();
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [userId, connect]);

  const sendMessage = useCallback(
    (question, mode = 'college', sessionId = null) => {
      if (!userId) return;
      const userMsg = {
        id: `u-${Date.now()}-${Math.random()}`,
        role: 'user',
        content: question,
        isDone: true,
      };
      setMessages((prev) => [...prev, userMsg]);
      const botId = `b-${Date.now()}-${Math.random()}`;
      botIdMapRef.current.set(sessionId || 'default', botId);
      setMessages((prev) => [
        ...prev,
        { id: botId, role: 'bot', content: '', sources: [], isDone: false },
      ]);
      setIsTyping(true);
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'question',
            content: question,
            mode,
            sessionId,
          }),
        );
      } else {
        // Surface a graceful error if we are offline.
        setIsTyping(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botId
              ? { ...m, content: '⚠️ Connection lost. Please refresh.', isDone: true }
              : m,
          ),
        );
      }
    },
    [userId],
  );

  const cancel = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'cancel' }));
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const retryConnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    setReconnectFailed(false);
    connect();
  }, [connect]);

  return {
    messages, setMessages, isTyping, connected,
    reconnectFailed, sendMessage, cancel, clearMessages, retryConnect,
  };
}

function applyEvent(msg, setMessages, setIsTyping, botIdMapRef) {
  // Resolve the active botId: use sessionId from `final` frames to look up,
  // otherwise fall back to the last entry in the map.
  function getBotId(sessionId) {
    if (sessionId && botIdMapRef.current.has(sessionId)) {
      return botIdMapRef.current.get(sessionId);
    }
    const entries = Array.from(botIdMapRef.current.values());
    return entries.length > 0 ? entries[entries.length - 1] : null;
  }

  switch (msg.type) {
    case 'ready':
      // Server acknowledged the connection.
      break;
    case 'status': {
      if (msg.stage === 'answered' || msg.stage === 'started' || msg.stage === 'cancelling') {
        // Streaming in progress; keep isTyping true.
      } else if (msg.stage === 'cancelled') {
        setIsTyping(false);
        const id = getBotId();
        if (id) {
          setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, isDone: true } : m)),
          );
        }
      }
      break;
    }
    case 'sources': {
      const id = getBotId();
      if (id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, sources: msg.sources || [] } : m)),
        );
      }
      break;
    }
    case 'token': {
      const id = getBotId();
      if (id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, content: (m.content || '') + (msg.content || '') } : m,
          ),
        );
      }
      break;
    }
    case 'final': {
      const id = getBotId(msg.sessionId);
      if (id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id
              ? {
                  ...m,
                  content: msg.answer || m.content,
                  traceId: msg.traceId,
                  model: msg.model,
                  confidence: msg.confidence,
                  sessionId: msg.sessionId,
                  detectedDates: msg.detectedDates || m.detectedDates || [],
                  isDone: true,
                }
              : m,
          ),
        );
        // Remove the botId from the map once the stream is done.
        botIdMapRef.current.delete(msg.sessionId);
      }
      setIsTyping(false);
      break;
    }
    case 'error':
      console.error('[WS] server error:', msg);
      setIsTyping(false);
      break;
    case 'pong':
      break;
    default:
      break;
  }
}
