import { Menu, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Sidebar } from './Sidebar';

export function Header() {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Mobile menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 bg-sidebar border-sidebar-border">
            <Sidebar />
          </SheetContent>
        </Sheet>

        {/* Title */}
        <div className="flex-1 text-center md:text-left md:ml-4">
          <h1 className="text-lg font-bold text-card-foreground">AFLV Operation Panel</h1>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <Button variant="ghost" size="icon" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {/* User info */}
          {profile && (
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <span>{profile.name}</span>
              <span className="text-primary font-medium">{profile.callsign}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}