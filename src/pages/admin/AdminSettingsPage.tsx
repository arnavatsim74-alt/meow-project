import { useEffect, useState } from 'react';
import { MapPin, Plus, Trash2, Save } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { SectionCard } from '@/components/ui/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DepartureBase {
  id: string;
  icao_code: string;
  name: string;
}

export default function AdminSettingsPage() {
  const [bases, setBases] = useState<DepartureBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIcao, setNewIcao] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchBases();
  }, []);

  const fetchBases = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('departure_bases')
      .select('*')
      .order('icao_code');
    if (data) setBases(data);
    setLoading(false);
  };

  const addBase = async () => {
    if (!newIcao.trim()) {
      toast.error('ICAO code is required');
      return;
    }
    setAdding(true);
    const { error } = await supabase.from('departure_bases').insert({
      icao_code: newIcao.toUpperCase().trim(),
      name: newName.trim() || newIcao.toUpperCase().trim(),
    });
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Base already exists' : error.message);
    } else {
      toast.success('Departure base added');
      setNewIcao('');
      setNewName('');
      fetchBases();
    }
    setAdding(false);
  };

  const deleteBase = async (id: string, icao: string) => {
    const { error } = await supabase.from('departure_bases').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete base');
    } else {
      toast.success(`${icao} removed`);
      fetchBases();
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Departure Bases */}
        <SectionCard
          title="Departure Bases"
          icon={<MapPin className="h-5 w-5 text-muted-foreground" />}
        >
          <p className="text-sm text-muted-foreground mb-4">
            Manage the list of departure bases pilots can choose when requesting a vCAREER.
          </p>

          {/* Add form */}
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="ICAO (e.g. UUEE)"
              value={newIcao}
              onChange={(e) => setNewIcao(e.target.value.toUpperCase())}
              maxLength={4}
              className="w-28"
            />
            <Input
              placeholder="Airport name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
            />
            <Button onClick={addBase} disabled={adding} className="gap-2">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-sm py-4">Loading...</p>
          ) : bases.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">No departure bases configured</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ICAO</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-20">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bases.map((base) => (
                    <TableRow key={base.id}>
                      <TableCell className="font-mono font-bold text-primary">{base.icao_code}</TableCell>
                      <TableCell>{base.name}</TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteBase(base.id, base.icao_code)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>
      </div>
    </AdminLayout>
  );
}
