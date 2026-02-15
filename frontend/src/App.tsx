import {
  Routes,
  Route,
  Outlet,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { useEffect, useRef } from 'react';
import Layout from './pages/Layout.tsx/Layout.tsx';
import { PublicRoute } from './Components/PublicRoute.tsx';
import ProtectedRoute from './Components/ProtectedRoute.tsx';
import Login from './pages/login/login.tsx';
import { useAppDispatch, useAppSelector } from './redux/store.ts';
import { clearError, FetchMe } from './redux/features/slices/authSlice.ts';
import BillDetailApproval from './pages/Bills/BillApproval.tsx';
import BillingList from './pages/Bills/BillingList.tsx';
import { FinanceLayout } from './pages/Layout.tsx/Finance.tsx';
import PaymentsList from './pages/Payments/PaymentsList.tsx';
import { RegisterUser } from './pages/Users/RegisterUser.tsx';
import { PriceListManagement } from './pages/Pricing/PriceList.tsx';
import { OrdersManagement } from './pages/Orders/orders-management.tsx';
import { OrderItemsManagement } from './pages/Orders/order-items-management.tsx';

function App() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { isAuthenticated, loading } = useAppSelector((state) => state.auth);

  const hasCheckedAuth = useRef(false);

  // Only check auth ONCE on initial app load
  useEffect(() => {
    const fetchme = async () => {
      try {
        await dispatch(FetchMe()).unwrap();
      } catch (error) {
        console.log(error);
        dispatch(clearError());
      }
    };
    if (!hasCheckedAuth.current) {
      hasCheckedAuth.current = true;
      console.log('Checking initial auth status');
      fetchme();
    }
  }, [dispatch]);

  useEffect(() => {
    // Only allow /login when not authenticated
    if (!loading && !isAuthenticated && location.pathname !== '/login') {
      navigate('/login', { replace: true });
    }
  }, [location.pathname, isAuthenticated, loading, navigate]);

  return (
    <Routes>
      {/* Public routes */}
      <Route element={<PublicRoute />}>
        <Route path='/login' element={<Login />} />
      </Route>

      {/* Root redirect */}
      <Route path='/' element={<Navigate to='/orders' replace />} />

      {/* Protected routes with Layout */}
      <Route element={<ProtectedRoute />}>
        <Route
          element={
            <Layout>
              <Outlet />
            </Layout>
          }
        >
          <Route path='/register-user' element={<RegisterUser />} />
          <Route path='/orders' element={<OrdersManagement />} />
          <Route path='orders/:id' element={<OrderItemsManagement />} />

          {/* Finance routes */}
          <Route path='/finance' element={<FinanceLayout />}>
            <Route path='bills' element={<BillingList />} />
            <Route path='bills/:id' element={<BillDetailApproval />} />
            <Route path='payments' element={<PaymentsList />} />
            <Route path='price-management' element={<PriceListManagement />} />
          </Route>
        </Route>
      </Route>

      {/* Catch-all - redirect to login */}
      <Route path='*' element={<Navigate to='/login' replace />} />
    </Routes>
  );
}

export default App;
