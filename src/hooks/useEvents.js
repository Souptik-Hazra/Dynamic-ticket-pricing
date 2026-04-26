import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { ENDPOINTS } from '../config/api';

export const useEvents = (page = 1, limit = 20) => {
  const queryClient = useQueryClient();

  // Prefetch next page for seamless navigation
  React.useEffect(() => {
    const nextPage = page + 1;
    queryClient.prefetchQuery({
      queryKey: ['events', nextPage, limit],
      queryFn: async () => {
        const url = `${ENDPOINTS.EVENTS}?page=${nextPage}&limit=${limit}`;
        const response = await api.get(url);
        return response.data;
      },
    });
  }, [page, limit, queryClient]);

  return useQuery({
    queryKey: ['events', page, limit],
    queryFn: async () => {
      const url = `${ENDPOINTS.EVENTS}?page=${page}&limit=${limit}`;
      const response = await api.get(url);
      return response.data; // { items, page, limit, total, totalPages }
    },
    keepPreviousData: true,
  });
};

export const useUpdatePrice = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (eventId) => {
      const response = await api.get(ENDPOINTS.EVENT_DYNAMIC_PRICES(eventId));
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};
