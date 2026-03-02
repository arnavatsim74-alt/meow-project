import { ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(180deg, #0c1929 0%, #0a1525 50%, #0d1f33 100%)'
    }}>
      <Header />
      <div className="flex">
        {/* Desktop sidebar */}
        <div className="hidden md:block w-64 fixed left-0 top-12 bottom-0 border-r" style={{
          borderColor: 'rgba(100, 150, 200, 0.1)'
        }}>
          <Sidebar />
        </div>
        
        {/* Main content */}
        <main className="flex-1 md:ml-64 p-4 md:p-6">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
