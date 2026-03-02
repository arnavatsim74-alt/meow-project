import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Sidebar } from './Sidebar';

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b" style={{
      background: 'linear-gradient(180deg, #0d1f33 0%, #0c1929 100%)',
      borderColor: 'rgba(100, 150, 200, 0.12)',
      boxShadow: '0 2px 12px rgba(0, 0, 0, 0.3)'
    }}>
      <div className="flex items-center justify-between px-4 h-12">
        {/* Mobile menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" style={{ color: 'hsl(210, 18%, 85%)' }} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 border-r" style={{ 
            background: 'linear-gradient(180deg, #0d1f33 0%, #0a1628 100%)',
            borderColor: 'rgba(100, 150, 200, 0.12)'
          }}>
            <Sidebar />
          </SheetContent>
        </Sheet>

        {/* Spacer for desktop */}
        <div className="flex-1" />
      </div>
    </header>
  );
}
