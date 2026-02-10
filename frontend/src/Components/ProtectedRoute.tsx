import {Navigate, useLocation} from 'react-router-dom';
import { useAppSelector } from '../redux/store';
import type { ReactNode } from 'react';

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const { isAuthenticated, loading } = useAppSelector((state) => state.auth);

  // Still checking auth → render nothing (or spinner)
  if (loading) {
    return null; // or <Spinner />
  }

  if (!isAuthenticated) {
    return <Navigate to='/login' state={{ from: location}} replace />;
  }

  return <>{children}</>;
};
