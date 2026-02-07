import React, { useState } from 'react';
import { Header, HeaderName, HeaderMenuButton } from '@carbon/react';
import './Layout.scss';
import {navItems} from "../../../../constants.tsx";

interface LayoutProps {
  title?: string;
  children?: React.ReactNode;
}

const Sidebar = () => {
  return (
<aside className='sidebar' aria-label='Primary'>
  <nav className='omrs-nav'>
    {
      navItems.map((item, i) => {
        return (
            <a className='omrs-nav__item' href={item.link} key={i}>
              {item.icon}
              <span className='omrs-nav__label'>{item.label}</span>
            </a>
        )
      })
    }
  </nav>

  <div className='sidebar__footer'>v0.1</div>
</aside>
  )
}
const Layout: React.FC<LayoutProps> = ({ title = '', children }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className='omrs-layout'>
      <Header aria-label={title} className='omrs-header'>
        <HeaderMenuButton
          aria-label='Toggle sidebar'
          onClick={() => setCollapsed((s) => !s)}
        />
        <HeaderName href='#' prefix='HBPS'>
          {title}
        </HeaderName>
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
