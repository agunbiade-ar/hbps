// components/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '../redux/store';

function ProtectedRoute() {
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to='/login' replace />;
  }

  // If authenticated, render child routes
  return <Outlet />;
}

export default ProtectedRoute;
