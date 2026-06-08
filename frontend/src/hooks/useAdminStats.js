import { useQuery } from '@tanstack/react-query';
import { getStats } from '../services/adminService';

export function useAdminStats() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['adminStats'],
    queryFn: async () => {
      const res = await getStats();
      return res.data;
    },
    staleTime: 30000,
    refetchInterval: 30000, // Keep stats updated every 30s
  });

  return {
    stats: data || null,
    loading: isLoading,
    refetch
  };
}
