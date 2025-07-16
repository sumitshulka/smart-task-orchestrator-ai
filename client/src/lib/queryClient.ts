import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Helper function for API requests
export async function apiRequest(url: string, options: RequestInit = {}) {
  // Get current user for authentication
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  const response = await fetch(url, {
    credentials: 'include', // Include session cookies for authentication
    headers: {
      'Content-Type': 'application/json',
      ...(user?.id && { 'x-user-id': user.id }),
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}