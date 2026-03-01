import { useEffect, useState } from 'react';
import { Plane, FileText, Users, UserPlus, Database } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { SectionCard } from '@/components/ui/section-card';
import { supabase } from '@/integrations/supabase/client';

export default function AdminPanel() {
  const [stats, setStats] = useState({
    pendingPireps: 0,
    pendingRegistrations: 0,
    pendingCareers: 0,
    fleetCount: 0,
    routeCount: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const [pireps, regs, careers, fleet, routes] = await Promise.all([
      supabase.from('pireps').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('registration_approvals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('career_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('virtual_fleet').select('id', { count: 'exact', head: true }),
      supabase.from('route_catalog').select('id', { count: 'exact', head: true }),
    ]);

    setStats({
      pendingPireps: pireps.count ?? 0,
      pendingRegistrations: regs.count ?? 0,
      pendingCareers: careers.count ?? 0,
      fleetCount: fleet.count ?? 0,
      routeCount: routes.count ?? 0,
    });
  };

  const cards = [
    { icon: FileText, label: 'Pending PIREPs', value: stats.pendingPireps, color: 'text-warning' },
    { icon: UserPlus, label: 'Pending Applications', value: stats.pendingRegistrations, color: 'text-info' },
    { icon: Users, label: 'Pending Careers', value: stats.pendingCareers, color: 'text-primary' },
    { icon: Plane, label: 'Fleet Aircraft', value: stats.fleetCount, color: 'text-success' },
    { icon: Database, label: 'Route Catalog', value: stats.routeCount, color: 'text-accent' },
  ];

  return (
    <AdminLayout>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-2xl font-bold text-card-foreground">{card.value}</p>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
