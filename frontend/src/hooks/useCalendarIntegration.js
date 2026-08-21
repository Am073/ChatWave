import { useQuery } from '@tanstack/react-query';
import { getCalendarStatus, getAuthUrl } from '../services/calendarService';
import { useEffect } from 'react';

export function useCalendarConnectionToast() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('calendar') === 'connected') {
      alert('✅ Google Calendar connected successfully!');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);
}

export function useCalendarIntegration() {
  // useQuery for status
  const { data: statusData, isLoading: calendarLoading, refetch: checkStatus } = useQuery({
    queryKey: ['calendarStatus'],
    queryFn: async () => {
      const res = await getCalendarStatus();
      return res.data;
    },
    retry: false
  });

  const calendarConnected = statusData?.connected === true;

  const handleConnect = async () => {
    try {
      const res = await getAuthUrl();
      // Our backend returns the authorization URL in { url: "..." }
      const url = res.data.url || res.data.auth_url;
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error('Calendar connect redirect error:', err);
    }
  };

  return {
    calendarConnected,
    calendarLoading,
    checkStatus,
    handleConnect,
  };
}
