import { type JSX } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../redux/store.ts';

export const PublicRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  return isAuthenticated ? <Navigate to='/dashboard' replace /> : children;
};
