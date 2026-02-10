import { Outlet } from 'react-router-dom';

// Create a layout component
export const FinanceLayout = () => {
  return (
    <div>
      <Outlet /> {/* Child routes render here */}
    </div>
  );
};

