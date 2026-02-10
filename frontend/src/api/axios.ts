// axios_api.ts
import axios from 'axios';
import { BACKEND_BASE_URL } from '../constants.tsx';
import {store} from "../redux/store.ts";
import {reset} from "../redux/features/slices/authSlice.ts";

export const axios_api = axios.create({
  baseURL: BACKEND_BASE_URL,
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve();
  });
  failedQueue = [];
};

axios_api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // We check 401. We DON'T refresh if the failed request WAS the login or refresh endpoint.
      if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          !originalRequest.url?.includes('/auth/login') &&
          !originalRequest.url?.includes('/auth/refresh')
      ) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
              .then(() => axios_api(originalRequest))
              .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          // FastAPI endpoint that verifies the refresh_token cookie and issues new access_token cookie
          await axios_api.post('/auth/refresh');

          isRefreshing = false;
          processQueue(null);

          return axios_api(originalRequest);
        } catch (refreshError) {
          isRefreshing = false;
          processQueue(refreshError);

          // OPTIONAL: Clear Redux state here if you export the store
          store.dispatch(reset())
          return Promise.reject(refreshError);
        }
      }
      return Promise.reject(error);
    }
);