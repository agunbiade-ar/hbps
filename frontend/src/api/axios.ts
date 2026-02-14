import axios from 'axios';
import { BACKEND_BASE_URL } from '../constants.tsx';
import { store } from '../redux/store.ts';
import { Logout } from '../redux/features/slices/authSlice.ts';

export const axios_api = axios.create({
  baseURL: BACKEND_BASE_URL,
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any = null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

axios_api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if it's a 401 and not already retried
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return axios_api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Call refresh endpoint
        await axios_api.post('/auth/refresh');

        // Process all queued requests
        processQueue(null);

        // Reset the flag
        isRefreshing = false;

        // Retry the original request
        return axios_api(originalRequest);
      } catch (refreshError: any) {
        // Process queue with error
        processQueue(refreshError);

        // Reset the flag
        isRefreshing = false;

        if (refreshError.response?.status === 401) {
          store.dispatch(Logout());
        }

        // Optional: Redirect to login
        // window.location.href = '/login';

        return Promise.reject(refreshError);
      }
    }

    // For all other errors, just reject
    return Promise.reject(error);
  },
);
