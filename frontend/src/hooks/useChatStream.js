import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../services/api';

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '')
  : '';

/**
 * useChatStream — v2 streaming hook.
 *
 * The v2 backend exposes chat streaming at `/api/chat/stream` as SSE
 * (Server-Sent Events) emitting `status`, `sources`, `final`, and `error`
 * events. Long-lived tokens are NEVER placed in query params (Risk #4
 * mitigation); auth is via same-site cookies attached by the browser.
 */
export function useChatStream(userId, collegeName) {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [connected, setConnected] = useState(false);
  const abortRef = useRef(null);

  // Reconnect logic is not needed for SSE (EventSource auto-reconnects).
  // We keep `connected` semantics for the UI.
  useEffect(() => {
    if (userId) setConnected(true);
  }, [userId]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const sendMessage = useCallback(
    async (question, mode = 'college', sessionId = null) => {
      if (!userId) return;
      setIsTyping(true);

      // Optimistic user message
      const userMsg = {
        id: Date.now() + Math.random(),
        role: 'user',
        content: question,
        isDone: true,
      };
      setMessages((prev) => [...prev, userMsg]);

      // Placeholder bot message that will be filled by streamed events
      const botId = Date.now() + Math.random() + 1;
      setMessages((prev) => [
        ...prev,
        { id: botId, role: 'bot', content: '', sources: [], isDone: false },
      ]);

      const abort = new AbortController();
      abortRef.current = abort;

      try {
        const url = `${API_BASE}/api/chat/stream?question=${encodeURIComponent(
          question,
        )}&mode=${encodeURIComponent(mode)}`;
        const res = await fetch(url, {
          method: 'GET',
          credentials: 'include', // send cookies
          signal: abort.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`Stream failed: ${res.status}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // SSE frames are separated by blank lines
          const frames = buffer.split('\n\n');
          buffer = frames.pop() || '';
          for (const frame of frames) {
            const line = frame.trim();
            if (!line) continue;
            const [prefix, ...rest] = line.split('\n');
            if (prefix.startsWith('event:')) {
              const eventName = prefix.replace('event:', '').trim();
              const dataLine = rest.join('\n').replace(/^data:\s*/, '');
              let payload;
              try {
                payload = JSON.parse(dataLine);
              } catch {
                payload = dataLine;
              }
              applyEvent(eventName, payload, botId, setMessages, setIsTyping);
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('[STREAM] Error:', err);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botId
                ? {
                    ...m,
                    content: m.content || '⚠️ Streaming failed.',
                    isDone: true,
                  }
                : m,
            ),
          );
        }
      } finally {
        setIsTyping(false);
      }
    },
    [userId],
  );

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, setMessages, isTyping, connected, sendMessage, clearMessages };
}

function applyEvent(eventName, payload, botId, setMessages, setIsTyping) {
  switch (eventName) {
    case 'status':
      // no-op for now; could be used to drive a status indicator
      break;
    case 'sources':
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botId ? { ...m, sources: payload.sources || [] } : m,
        ),
      );
      break;
    // FIX[9]: Handle streamed token chunks for real-time typing effect
    case 'token':
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botId
            ? { ...m, content: (m.content || '') + (payload.content || '') }
            : m,
        ),
      );
      break;
    case 'final':
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botId
            ? {
                ...m,
                content: payload.answer || m.content,
                traceId: payload.traceId,
                model: payload.model,
                confidence: payload.confidence,
                isDone: true,
              }
            : m,
        ),
      );
      setIsTyping(false);
      break;
    case 'error':
      console.error('[STREAM] server error:', payload);
      setIsTyping(false);
      break;
    default:
      // unknown event — ignore
      break;
  }
}