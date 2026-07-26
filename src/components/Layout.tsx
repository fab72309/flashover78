import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import Header from './Header';
import Sidebar from './Sidebar';
import { type CSSProperties, useState } from 'react';

const DEFAULT_SIDEBAR_WIDTH = 288;
const COLLAPSED_SIDEBAR_WIDTH = 88;

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarWidth, setDesktopSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);

  const handleMenuClick = () => {
    setSidebarOpen(true);
  };

  const sidebarOffset = desktopSidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : desktopSidebarWidth;
  const layoutStyle = {
    '--sidebar-offset': `${sidebarOffset}px`,
  } as CSSProperties;

  return (
    <div className="min-h-screen bg-surface text-on-surface" style={layoutStyle}>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        desktopWidth={desktopSidebarWidth}
        isDesktopCollapsed={desktopSidebarCollapsed}
        onDesktopWidthChange={setDesktopSidebarWidth}
        onDesktopCollapsedChange={setDesktopSidebarCollapsed}
      />

      <div className="flex min-h-screen flex-col transition-[padding] duration-300 lg:pl-[var(--sidebar-offset)]">
        <Header onMenuClick={handleMenuClick} />
        <main className="mx-auto flex-1 px-4 py-5 pb-28 transition-all w-full max-w-6xl sm:px-6 lg:max-w-none lg:px-8 lg:py-8 lg:pb-10 xl:px-10">
          <Outlet />
        </main>
        <Navigation />
      </div>
    </div>
  );
}

export default Layout;
