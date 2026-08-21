import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../services/api';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

/**
 * useAnnouncementStream — Server-Sent Events consumer for live announcements.
 *
 * The backend exposes a tenant-scoped SSE stream at /api/announcements/stream.
 * When a faculty/admin creates a new announcement, this hook surfaces the
 * payload and an unread counter.
 */
export function useAnnouncementStream(userId) {
  const [events, setEvents] = useState([]);
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(false);
  const esRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  useEffect(() => {
    if (!userId) {
      setConnected(false);
      return undefined;
    }
    let cancelled = false;

    const connect = () => {
      const url = `${API_BASE}/api/announcements/stream`;
      const es = new EventSource(url, { withCredentials: true });
      esRef.current = es;

      es.addEventListener('ready', () => {
        if (!cancelled) setConnected(true);
      });

      es.addEventListener('announcement', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (!cancelled) {
            setEvents((prev) => [payload, ...prev].slice(0, 50));
            setUnread((n) => n + 1);
          }
        } catch {
          /* ignore malformed frames */
        }
      });

      es.addEventListener('error', () => {
        setConnected(false);
        es.close();
        if (!cancelled) {
          reconnectTimerRef.current = setTimeout(connect, 3000);
        }
      });
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (esRef.current) esRef.current.close();
    };
  }, [userId]);

  const markAllRead = useCallback(() => setUnread(0), []);

  return { events, unread, connected, markAllRead };
}

/**
 * useAnnouncements — REST-backed list + manual refresh.
 */
export function useAnnouncements(params = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/announcements', { params });
      setData(res.data || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh, setData };
}
