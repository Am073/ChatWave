import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../services/api';

export function useWebSocket(userId, collegeName) {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectDelayRef = useRef(1000); // 1s initial delay
  const connectionEpochRef = useRef(0);

  const connect = useCallback(async () => {
    if (!userId) return;
    const epoch = ++connectionEpochRef.current;

    try {
      // Fetch access token via CSRF token endpoint (Fixes Bug #5)
      const res = await api.get('/auth/csrf-token');
      
      // Abort if a newer connection attempt has started
      if (epoch !== connectionEpochRef.current) {
        console.log('[WS] Connection aborted: a newer connect attempt was initiated.');
        return;
      }

      const token = res.data.accessToken;

      if (!token) {
        console.warn('[WS] No active token available. Cannot connect.');
        return;
      }

      // Close previous connection if active
      if (wsRef.current && wsRef.current.readyState < WebSocket.CLOSING) {
        wsRef.current.wasIntentionalClose = true;
        wsRef.current.close(1000, 'Reconnecting');
      }

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const defaultWsUrl = `${wsProtocol}//${window.location.host}`;
      const wsBase = import.meta.env.VITE_WS_URL || defaultWsUrl;
      const url = `${wsBase}/ws`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Socket opened. Sending authentication handshake...');
        // Handshake packet sent as the FIRST message payload (Fixes Bug #5)
        ws.send(JSON.stringify({ type: 'auth', token }));
      };

      ws.onclose = (event) => {
        setConnected(false);
        console.log(`[WS] Socket closed. Code: ${event.code}, Reason: ${event.reason}`);
        
        // Reconnect if not closed normally and not intentionally closed
        if (event.code !== 1000 && event.code !== 1001 && !ws.wasIntentionalClose) {
          const delay = reconnectDelayRef.current;
          console.log(`[WS] Reconnecting in ${delay}ms...`);
          reconnectTimer.current = setTimeout(() => {
            reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30000); // exponential backoff capped at 30s
            connect();
          }, delay);
        }
      };

      ws.onerror = (err) => {
        console.error('[WS] Connection error:', err);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'auth_success') {
            setConnected(true);
            reconnectDelayRef.current = 1000; // Reset delay on success
            console.log('[WS] Handshake successful. Connection is authenticated.');
          } else if (data.type === 'chunk') {
            setIsTyping(true);
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'bot' && !last.isDone) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: last.content + data.text },
                ];
              } else {
                return [
                  ...prev,
                  {
                    id: Date.now() + Math.random(),
                    role: 'bot',
                    content: data.text,
                    sources: [],
                    isDone: false,
                  },
                ];
              }
            });
          } else if (data.type === 'sources') {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'bot' && !last.isDone) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, sources: data.sources },
                ];
              } else {
                return [
                  ...prev,
                  {
                    id: Date.now() + Math.random(),
                    role: 'bot',
                    content: '',
                    sources: data.sources,
                    isDone: false,
                  },
                ];
              }
            });
          } else if (data.type === 'done') {
            setIsTyping(false);
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'bot') {
                return [
                  ...prev.slice(0, -1),
                  { ...last, isDone: true, sessionId: data.sessionId },
                ];
              }
              return prev;
            });
          } else if (data.type === 'error') {
            console.error('[WS Server Error]:', data.error);
            setIsTyping(false);
          }
        } catch (e) {
          console.error('[WS] Parse message error:', e);
        }
      };
    } catch (err) {
      console.error('[WS] Connect initiation failed:', err);
    }
  }, [userId]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close(1000, 'Component unmounted');
    };
  }, [connect]);

  const sendMessage = useCallback((question, mode = 'college', sessionId = null) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setIsTyping(true);
      wsRef.current.send(JSON.stringify({ type: 'query', question, mode, sessionId }));
    } else {
      console.warn('[WS] Cannot send message: Connection is not open');
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, setMessages, isTyping, connected, sendMessage, clearMessages };
}