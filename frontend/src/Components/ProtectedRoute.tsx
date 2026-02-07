import {useAppSelector} from "../redux/store.ts";

import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
    const is_authenticated = useAppSelector((state) => state.auth.isAuthenticated);

    if (!is_authenticated) {
        return <Navigate to='/login' replace />;
    }
    return <>{children}</>;
};
