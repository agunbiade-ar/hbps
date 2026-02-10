import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import Layout from './pages/Layout.tsx/Layout.tsx';
import Dashboard from './pages/dashboard/Dashboard';
import { PublicRoute } from './Components/PublicRoute.tsx';
import { ProtectedRoute } from './Components/ProtectedRoute.tsx';
import Login from './pages/login/login.tsx';
import { useAppDispatch, useAppSelector } from './redux/store.ts';
import { FetchMe } from './redux/features/slices/authSlice.ts';
import BillDetailApproval from './pages/Bills/BillApproval.tsx';
import BillingList from './pages/Bills/BillingList.tsx';
import { useEffect } from 'react';
import { FinanceLayout } from './pages/Layout.tsx/Finance.tsx';
import { useNavigate } from 'react-router-dom';
import PaymentsList from './pages/Payments/PaymentsList.tsx';

function App() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isAuthenticated, loading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    dispatch(FetchMe());
  }, [dispatch]);

  useEffect(() => {
    //we are redirecting because the user is not logged in, the fetchme
    //endpoint returned a 401 status code

    if (!loading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate]);

  return (
    <>
      <Routes>
        <Route
          path='/login'
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        <Route
          path='/'
          element={
            <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <Layout>
                {/* Nested routes will be rendered here */}
                <Outlet />
              </Layout>
            </ProtectedRoute>
          }
        >
          <Route path='/dashboard' element={<Dashboard />} />
          <Route path='/finance' element={<FinanceLayout />}>
            <Route path='/finance/bills' element={<BillingList />} />
            <Route path='/finance/bills/:id' element={<BillDetailApproval />} />
            <Route path='/finance/payments' element={<PaymentsList />} />
            {/* <Route path='/payments/:id' element={<BillingList />} /> */}
          </Route>
        </Route>
      </Routes>
    </>
  );
}

export default App;
