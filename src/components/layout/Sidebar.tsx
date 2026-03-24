import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Plane, 
  FileText, 
  Trophy, 
  BookOpen, 
  Award,
  Users,
  LogOut,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';

const pilotNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Plane, label: 'Flight Dispatch', href: '/dispatch' },
  { icon: FileText, label: 'Flight Briefing', href: '/simbrief' },
  { icon: BookOpen, label: 'My Flight Plans', href: '/my-flight-plans' },
  { icon: FileText, label: 'Submit PIREP', href: '/pirep' },
  { icon: BookOpen, label: 'My PIREPs', href: '/my-pireps' },
  { icon: Plane, label: 'Virtual Fleet', href: '/fleet' },
  { icon: Award, label: 'Type Rating Shop', href: '/shop' },
  { icon: Trophy, label: 'Leaderboards', href: '/leaderboards' },
  { icon: BookOpen, label: 'Logbook', href: '/logbook' },
  { icon: FileText, label: 'NOTAM', href: '/notams' },
  { icon: Plane, label: 'Aeronautical Charts', href: '/charts' },
  { icon: Award, label: 'Crew Center', href: 'https://crew-aflv.vercel.app', external: true },
  { icon: BookOpen, label: 'Panel Manual', href: 'https://www.aeroflotvirtual.dpdns.org', external: true },
];

const adminNavItems = [
  { icon: Users, label: 'Admin Panel', href: '/admin' },
];

export function Sidebar() {
  const location = useLocation();
  const { profile, isAdmin, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [accountExpanded, setAccountExpanded] = useState(true);

  return (
    <aside className={cn(
      "flex flex-col h-full relative z-50",
      theme === 'dark' ? "text-white" : "text-gray-900"
    )} style={{
      background: theme === 'dark' 
        ? 'linear-gradient(180deg, #0d1f33 0%, #0a1628 100%)'
        : 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
      boxShadow: '2px 0 16px rgba(0, 0, 0, 0.1)'
    }}>
      {/* Brand Header */}
      <div className="p-4 border-b" style={{ 
        borderColor: theme === 'dark' ? 'rgba(100, 150, 200, 0.1)' : 'rgba(0, 0, 0, 0.1)' 
      }}>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold" style={{ 
            color: theme === 'dark' ? 'hsl(185, 80%, 55%)' : '#0ea5e9',
            textShadow: theme === 'dark' ? '0 0 10px hsl(185, 80%, 55% / 0.5)' : 'none'
          }}>AFLV OPS</h1>
        </div>
        <p className="text-xs" style={{ 
          color: theme === 'dark' ? 'rgba(210, 220, 235, 0.5)' : 'rgba(30, 41, 59, 0.6)' 
        }}>Aeroflot Virtual vCAREER</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-0.5">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ 
            color: theme === 'dark' ? 'rgba(210, 220, 235, 0.35)' : 'rgba(30, 41, 59, 0.5)' 
          }}>Menu</p>
          {pilotNavItems.map((item) => (
            item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                  theme === 'dark' 
                    ? "text-muted-foreground hover:text-foreground hover:bg-white/5" 
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                  location.pathname === item.href
                    ? theme === 'dark'
                      ? "bg-primary/10 text-primary border-l-2 border-primary"
                      : "bg-sky-100 text-sky-700 border-l-2 border-sky-500"
                    : theme === 'dark'
                      ? "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          ))}
        </div>

        {isAdmin && (
          <div className="space-y-0.5 mt-6">
            <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ 
              color: theme === 'dark' ? 'rgba(210, 220, 235, 0.35)' : 'rgba(30, 41, 59, 0.5)' 
            }}>Admin</p>
            {adminNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                  location.pathname.startsWith('/admin')
                    ? theme === 'dark'
                      ? "bg-primary/10 text-primary border-l-2 border-primary"
                      : "bg-sky-100 text-sky-700 border-l-2 border-sky-500"
                    : theme === 'dark'
                      ? "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Account Section - Collapsible */}
      <div className="border-t" style={{ 
        borderColor: theme === 'dark' ? 'rgba(100, 150, 200, 0.1)' : 'rgba(0, 0, 0, 0.1)' 
      }}>
        {/* Collapse Button */}
        <button 
          onClick={() => setAccountExpanded(!accountExpanded)}
          className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wider"
          style={{ 
            color: theme === 'dark' ? 'rgba(210, 220, 235, 0.5)' : 'rgba(30, 41, 59, 0.5)' 
          }}
        >
          <span>Account</span>
          {accountExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>

        {/* Collapsible Content */}
        {accountExpanded && (
          <div className="p-3 space-y-2">
            {/* User Info */}
            <div 
              className="flex items-center gap-2 px-2 py-2 rounded-lg" 
              style={{ 
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)' 
              }}
            >
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ 
                  background: theme === 'dark' 
                    ? 'linear-gradient(135deg, hsl(185, 80%, 20%) 0%, hsl(185, 80%, 15%) 100%)'
                    : 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
                  boxShadow: theme === 'dark' ? '0 0 10px hsl(185, 80%, 55% / 0.2)' : '0 0 10px rgba(14, 165, 233, 0.2)'
                }}
              >
                <span 
                  className="text-sm font-semibold" 
                  style={{ 
                    color: theme === 'dark' ? 'hsl(185, 80%, 55%)' : '#0284c7' 
                  }}
                >
                  {profile?.name?.charAt(0) || 'P'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p 
                  className="text-sm font-medium truncate" 
                  style={{ 
                    color: theme === 'dark' ? 'hsl(210, 18%, 85%)' : '#1e293b' 
                  }}
                >
                  {profile?.name || 'Pilot'}
                </p>
                <p 
                  className="text-xs" 
                  style={{ 
                    color: theme === 'dark' ? 'rgba(210, 220, 235, 0.5)' : 'rgba(30, 41, 59, 0.6)' 
                  }}
                >
                  {isAdmin ? 'Administrator' : 'Pilot'}
                </p>
              </div>
            </div>

            {/* Callsign */}
            {profile?.callsign && (
              <div 
                className="px-2 py-1 rounded text-center" 
                style={{ 
                  background: theme === 'dark' ? 'rgba(6, 182, 212, 0.1)' : 'rgba(14, 165, 233, 0.1)',
                  border: theme === 'dark' ? '1px solid rgba(6, 182, 212, 0.2)' : '1px solid rgba(14, 165, 233, 0.2)'
                }}
              >
                <span 
                  className="text-xs font-mono font-semibold" 
                  style={{ 
                    color: theme === 'dark' ? 'hsl(185, 80%, 55%)' : '#0284c7' 
                  }}
                >
                  {profile.callsign}
                </span>
              </div>
            )}

            {/* Actions */}
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-3 text-sm h-9"
              style={{ 
                color: theme === 'dark' ? 'rgba(210, 220, 235, 0.6)' : 'rgba(30, 41, 59, 0.7)' 
              }}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="text-xs">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </Button>
            
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-3 text-sm h-9"
              style={{ 
                color: theme === 'dark' ? 'rgba(210, 220, 235, 0.6)' : 'rgba(30, 41, 59, 0.7)' 
              }}
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" />
              <span className="text-xs">Sign Out</span>
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
