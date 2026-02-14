import React, { useState } from 'react';
import { Header, HeaderName, HeaderMenuButton, Button } from '@carbon/react';
// import { Logout } from '@carbon/icons-react';
// import Button from '@carbon/react';
import './Layout.scss';
import { navItems } from '../../constants.tsx';
import { Link, useNavigate } from 'react-router-dom';
import { Logout } from '@carbon/icons-react';

import {
  Logout as logout,
  reset,
} from '../../redux/features/slices/authSlice.ts';
import { useAppDispatch, useAppSelector } from '../../redux/store.ts';

interface LayoutProps {
  title?: string;
  children?: React.ReactNode;
}

const Sidebar = () => {
  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>({});

  const toggleGroup = (idx: number) => {
    setOpenGroups((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <aside className='sidebar' aria-label='Primary'>
      <nav className='omrs-nav'>
        {navItems.map((item, i) => {
          const hasSub = !!item.sub_routes?.length;

          if (hasSub) {
            const isOpen = !!openGroups[i];
            return (
              <div className='omrs-nav-group' key={item.link + i}>
                <button
                  type='button'
                  className='omrs-nav__item omrs-nav__group-toggle'
                  onClick={() => toggleGroup(i)}
                  aria-expanded={isOpen}
                >
                  <span className='omrs-nav__icon'>{item.icon}</span>
                  <h3 className='omrs-nav__label'>{item.label}</h3>
                  <span className={`omrs-nav__caret ${isOpen ? 'open' : ''}`}>
                    {isOpen ? '▾' : '▸'}
                  </span>
                </button>

                <div className={`omrs-subroutes ${isOpen ? 'open' : ''}`}>
                  {item.sub_routes!.map((r) => (
                    <Link
                      className='omrs-nav__item omrs-subroute-item'
                      to={item.link + r.link}
                      key={item.link + r.link}
                    >
                      <span className='omrs-nav__label'>{r.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <Link className='omrs-nav__item' to={item.link} key={i}>
              {item.icon}
              <h3 className='omrs-nav__label'>{item.label}</h3>
            </Link>
          );
        })}
      </nav>

      {/* <div className='sidebar__footer'>v0.1</div> */}
    </aside>
  );
};
const Layout: React.FC<LayoutProps> = ({ title = '', children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();

  const handleLogout = async () => {
    try {
      await dispatch(logout()).unwrap();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, clear local state
      dispatch(reset());
      navigate('/login', { replace: true });
    }
  };
  return (
    <div className='omrs-layout'>
      <Header aria-label={title} className='omrs-header'>
        <HeaderMenuButton
          aria-label='Toggle sidebar'
          onClick={() => setCollapsed((s) => !s)}
        />
        <HeaderName href='' prefix='HBPS'>
          {title}
        </HeaderName>

        <div className='omrs-header__user'>
          <span className='omrs-header__user-name'>{user?.username}</span>
        </div>

        <Button
          hasIconOnly
          renderIcon={Logout}
          tooltipPosition='bottom'
          iconDescription='Logout'
          onClick={handleLogout}
          kind='ghost'
          className='omrs-header__logout'
        />
      </Header>

      <div className={`omrs-shell ${collapsed ? 'collapsed' : ''}`}>
        <Sidebar />
        <main className='omrs-content' role='main'>
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
