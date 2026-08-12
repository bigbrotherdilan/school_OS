import axios, { type AxiosResponse } from 'axios';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    const { token, sessionId } = useAuthStore.getState();
    const { activeTenantId } = useTenantStore.getState();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (activeTenantId) {
      config.headers['X-Tenant-ID'] = activeTenantId;
    }

    if (sessionId) {
      config.headers['X-Session-ID'] = sessionId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: any) => void; reject: (reason?: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const isAuthEndpoint = originalRequest.url?.includes('/auth/login/') || originalRequest.url?.includes('/auth/register/');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      const { logout } = useAuthStore.getState();

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${BASE_URL}/auth/refresh/`, {}, {
          withCredentials: true,
        });
        const { access } = res.data;
        useAuthStore.getState().setToken(access);
        processQueue(null, access);
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export async function apiFetchAll<T = any>(url: string, params: Record<string, any> = {}): Promise<T[]> {
  const all: T[] = [];
  let pageUrl: string | null = url;
  let first = true;
  while (pageUrl) {
    const res: AxiosResponse = await api.get(pageUrl, first ? { params } : {});
    first = false;
    const data = res.data;
    if (Array.isArray(data)) {
      return data;
    }
    all.push(...(data.results || []));
    pageUrl = data.next || null;
  }
  return all;
}
