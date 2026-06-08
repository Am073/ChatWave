import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDocumentStatus } from '../services/uploadService';

export function useDocumentStatus(documentId, onComplete) {
  const firedRef = useRef(false);

  const { data } = useQuery({
    queryKey: ['documentStatus', documentId],
    queryFn: async () => {
      if (!documentId) return null;
      const res = await getDocumentStatus(documentId);
      return res.data;
    },
    enabled: !!documentId,
    // Polling interval: 3000ms, stops when completed or failed
    refetchInterval: (query) => {
      const doc = query.state.data;
      if (doc && (doc.status === 'completed' || doc.status === 'failed')) {
        return false;
      }
      return 3000;
    },
  });

  // Fire onComplete once when status reaches 'completed'
  useEffect(() => {
    if (data?.status === 'completed' && !firedRef.current) {
      firedRef.current = true;
      if (typeof onComplete === 'function') onComplete();
    }
  }, [data?.status, onComplete]);

  return {
    status: data?.status || 'pending',
    chunkCount: data?.chunk_count || 0,
    error: data?.error_message || null,
  };
}
