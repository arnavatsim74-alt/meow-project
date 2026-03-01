import { Navigate, Link, useLocation } from 'react-router-dom';
import { Plane, FileText, Users, Settings, Database, UserPlus, LayoutDashboard } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const adminTabs = [
  { icon: LayoutDashboard, label: 'Overview', href: '/admin' },
  { icon: FileText, label: 'PIREPs', href: '/admin/pireps' },
  { icon: Plane, label: 'Fleet', href: '/admin/fleet' },
  { icon: UserPlus, label: 'Applications', href: '/admin/registrations' },
  { icon: Users, label: 'Careers', href: '/admin/careers' },
  { icon: Database, label: 'Routes', href: '/admin/routes' },
  { icon: Settings, label: 'Settings', href: '/admin/settings' },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Plane className="h-8 w-8 animate-pulse text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto gap-1 p-1 bg-muted rounded-lg border border-border">
          {adminTabs.map((tab) => {
            const isActive = location.pathname === tab.href;
            return (
              <Link
                key={tab.href}
                to={tab.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </div>

        {children}
      </div>
    </DashboardLayout>
  );
}
