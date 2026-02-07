import { type JSX } from 'react';
import { Navigate } from 'react-router-dom';
import {useAppSelector} from "../redux/store.ts";

export const PublicRoute = ({ children }: { children: JSX.Element }) => {
    const user_is_authenticated = useAppSelector((state) => state.auth.isAuthenticated);
    return user_is_authenticated? <Navigate to='/dashboard' replace /> : children;
};
