import axios from 'axios';
import type { AxiosResponse, AxiosError} from "axios";
import type { NavigateFunction } from 'react-router-dom';
import {BACKEND_BASE_URL} from "../constants.tsx";

export const axios_api = axios.create({
    baseURL: BACKEND_BASE_URL
});

let navigate: NavigateFunction | null = null;

export const setNavigationFunction = (navigationFunction: NavigateFunction) => {
    navigate = navigationFunction;
};

axios_api.interceptors.response.use(
    (response: AxiosResponse) => response, (error: AxiosError) => {
        if (error.response && error.response.status === 401) {
            // Check if it's a login request - don't redirect for login failures
            const isLoginRequest = error.config?.url?.includes('/login');
            // Only redirect if it's not a login request
            if (!isLoginRequest) {
                // Token expired or unauthorized - redirect to login
                localStorage.removeItem('user');
                // Use React Router navigation if available, otherwise fallback to window.location
                if (navigate) {
                    navigate('/login');
                } else {
                    window.location.href = '/login';
                }
            }
        }
        return Promise.reject(error)
    }
)