import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import Layout from './pages/login/Components/Layout.tsx/Layout';
import Dashboard from './pages/dashboard/Dashboard';
import Bills from './pages/Bills/BillingList.tsx';
import { PublicRoute } from './Components/PublicRoute.tsx';
import { ProtectedRoute } from './Components/ProtectedRoute.tsx';
import Login from './pages/login/login.tsx';
import BillApproval from './pages/Bills/BillApproval.tsx';

function App() {
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
        <Route path='/' element={<Navigate to={'/dashboard'} replace />} />

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
          <Route path='/bills' element={<Bills />} />
          <Route path='/bills/:id' element={<BillApproval />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
