import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '../redux/store';

export function PublicRoute() {
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  if (isAuthenticated) {
    return <Navigate to='/finance/bills' replace />;
  }

  return <Outlet />;
}
