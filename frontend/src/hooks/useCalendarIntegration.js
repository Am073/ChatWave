import { useQuery, useMutation } from '@tanstack/react-query';
import { getCalendarStatus, getAuthUrl, syncCalendarEvent } from '../services/calendarService';

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

  // useMutation for sync
  const syncMutation = useMutation({
    mutationFn: async (eventId) => {
      const res = await syncCalendarEvent(eventId);
      return res.data;
    }
  });

  return {
    calendarConnected,
    calendarLoading,
    checkStatus,
    handleConnect,
    syncMutation,
    syncEvent: syncMutation.mutateAsync,
  };
}
