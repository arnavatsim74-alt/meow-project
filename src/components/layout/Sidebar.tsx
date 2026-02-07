import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Plane, 
  FileText, 
  Trophy, 
  BookOpen, 
  Award,
  Settings,
  Users,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

const pilotNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Plane, label: 'Flight Dispatch', href: '/dispatch' },
  { icon: FileText, label: 'OFP Generator', href: '/simbrief' },
  { icon: BookOpen, label: 'My Flight Plans', href: '/my-flight-plans' },
  { icon: FileText, label: 'Submit PIREP', href: '/pirep' },
  { icon: BookOpen, label: 'My PIREPs', href: '/my-pireps' },
  { icon: Plane, label: 'Virtual Fleet', href: '/fleet' },
  { icon: Award, label: 'Type Rating Shop', href: '/shop' },
  { icon: Trophy, label: 'Leaderboards', href: '/leaderboards' },
  { icon: BookOpen, label: 'Logbook', href: '/logbook' },
  { icon: FileText, label: 'NOTAM', href: '/notams' },
  { icon: Plane, label: 'Aeronautical Charts', href: '/charts' },
  { icon: Award, label: 'Crew Center', href: 'https://crew.aeroflotvirtual.dpdns.org' },
  { icon: BookOpen, label: 'Panel Manual', href: 'https://www.aeroflotvirtual.dpdns.org' },
];

const adminNavItems = [
  { icon: Users, label: 'Admin Panel', href: '/admin' },
  { icon: Plane, label: 'Assign Dispatch', href: '/admin/dispatch' },
  { icon: FileText, label: 'Review PIREPs', href: '/admin/pireps' },
  { icon: Settings, label: 'Settings', href: '/admin/settings' },
];

export function Sidebar() {
  const location = useLocation();
  const { profile, isAdmin, signOut } = useAuth();

  return (
    <aside className="flex flex-col h-full bg-sidebar text-sidebar-foreground relative z-50">
      {/* Brand Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-primary">AFLV OPS</h1>
        </div>
        <p className="text-xs text-sidebar-foreground/70">Aeroflot Virtual vCAREER</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          <p className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/50 uppercase">Menu</p>
          {pilotNavItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                location.pathname === item.href
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'hover:bg-sidebar-accent text-sidebar-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>

        {isAdmin && (
          <div className="space-y-1 mt-6">
            <p className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/50 uppercase">Admin Menu</p>
            {adminNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  location.pathname === item.href
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'hover:bg-sidebar-accent text-sidebar-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Account Section */}
      <div className="p-4 border-t border-sidebar-border">
        <p className="px-1 py-1 text-xs font-semibold text-sidebar-foreground/50 uppercase mb-2">Account</p>
        <div className="flex items-center gap-3 px-1 py-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
            <span className="text-sm font-medium text-sidebar-foreground">
              {profile?.name?.charAt(0) || 'P'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate text-sidebar-foreground">{profile?.name || 'Pilot'}</p>
            <p className="text-xs text-sidebar-foreground/70">{isAdmin ? 'Admin' : 'Pilot'}</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent mt-2"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
