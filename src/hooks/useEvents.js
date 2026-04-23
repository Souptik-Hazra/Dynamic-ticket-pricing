import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { ENDPOINTS } from '../config/api';

export const useEvents = () => {
  return useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.EVENTS || '/events');
      return response.data;
    },
  });
};

export const useUpdatePrice = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (eventId) => {
      const response = await api.get(`/events/${eventId}/dynamic-prices`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};
