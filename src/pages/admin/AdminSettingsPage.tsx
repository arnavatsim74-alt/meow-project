import { useEffect, useState } from 'react';
import { MapPin, Plus, Trash2, Award, Save } from 'lucide-react';
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

interface RankRow {
  id: string;
  name: string;
  min_hours: number;
  sort_order: number;
}

export default function AdminSettingsPage() {
  const [bases, setBases] = useState<DepartureBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIcao, setNewIcao] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  // Ranks state
  const [ranks, setRanks] = useState<RankRow[]>([]);
  const [ranksLoading, setRanksLoading] = useState(true);
  const [newRankName, setNewRankName] = useState('');
  const [newRankHours, setNewRankHours] = useState('');
  const [addingRank, setAddingRank] = useState(false);

  useEffect(() => {
    fetchBases();
    fetchRanks();
  }, []);

  const fetchBases = async () => {
    setLoading(true);
    const { data } = await supabase.from('departure_bases').select('*').order('icao_code');
    if (data) setBases(data);
    setLoading(false);
  };

  const addBase = async () => {
    if (!newIcao.trim()) { toast.error('ICAO code is required'); return; }
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
    if (error) { toast.error('Failed to delete base'); } else { toast.success(`${icao} removed`); fetchBases(); }
  };

  // Ranks CRUD
  const fetchRanks = async () => {
    setRanksLoading(true);
    const { data } = await supabase.from('ranks').select('*').order('sort_order');
    if (data) setRanks(data as RankRow[]);
    setRanksLoading(false);
  };

  const addRank = async () => {
    if (!newRankName.trim() || !newRankHours.trim()) { toast.error('Name and hours required'); return; }
    setAddingRank(true);
    const maxOrder = ranks.length > 0 ? Math.max(...ranks.map(r => r.sort_order)) + 1 : 0;
    const { error } = await supabase.from('ranks').insert({
      name: newRankName.trim(),
      min_hours: parseFloat(newRankHours),
      sort_order: maxOrder,
    });
    if (error) { toast.error(error.message); } else {
      toast.success('Rank added');
      setNewRankName('');
      setNewRankHours('');
      fetchRanks();
    }
    setAddingRank(false);
  };

  const deleteRank = async (id: string, name: string) => {
    const { error } = await supabase.from('ranks').delete().eq('id', id);
    if (error) { toast.error('Failed to delete rank'); } else { toast.success(`${name} removed`); fetchRanks(); }
  };

  const updateRank = async (id: string, field: 'name' | 'min_hours' | 'sort_order', value: string | number) => {
    const { error } = await supabase.from('ranks').update({ [field]: value }).eq('id', id);
    if (error) { toast.error('Failed to update'); } else { fetchRanks(); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Departure Bases */}
        <SectionCard title="Departure Bases" icon={<MapPin className="h-5 w-5 text-muted-foreground" />}>
          <p className="text-sm text-muted-foreground mb-4">
            Manage the list of departure bases pilots can choose when requesting a vCAREER.
          </p>
          <div className="flex gap-2 mb-4">
            <Input placeholder="ICAO (e.g. UUEE)" value={newIcao} onChange={(e) => setNewIcao(e.target.value.toUpperCase())} maxLength={4} className="w-28" />
            <Input placeholder="Airport name" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1" />
            <Button onClick={addBase} disabled={adding} className="gap-2"><Plus className="h-4 w-4" />Add</Button>
          </div>
          {loading ? (
            <p className="text-muted-foreground text-sm py-4">Loading...</p>
          ) : bases.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">No departure bases configured</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>ICAO</TableHead><TableHead>Name</TableHead><TableHead className="w-20">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {bases.map((base) => (
                    <TableRow key={base.id}>
                      <TableCell className="font-mono font-bold text-primary">{base.icao_code}</TableCell>
                      <TableCell>{base.name}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteBase(base.id, base.icao_code)}>
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

        {/* Rank Criteria */}
        <SectionCard title="Rank Criteria" icon={<Award className="h-5 w-5 text-muted-foreground" />}>
          <p className="text-sm text-muted-foreground mb-4">
            Define pilot ranks and the minimum flight hours required for each.
          </p>
          <div className="flex gap-2 mb-4">
            <Input placeholder="Rank name" value={newRankName} onChange={(e) => setNewRankName(e.target.value)} className="flex-1" />
            <Input placeholder="Min hours" type="number" value={newRankHours} onChange={(e) => setNewRankHours(e.target.value)} className="w-28" />
            <Button onClick={addRank} disabled={addingRank} className="gap-2"><Plus className="h-4 w-4" />Add</Button>
          </div>
          {ranksLoading ? (
            <p className="text-muted-foreground text-sm py-4">Loading...</p>
          ) : ranks.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">No ranks configured</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Name</TableHead><TableHead>Min Hours</TableHead><TableHead className="w-20">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {ranks.map((rank) => (
                    <TableRow key={rank.id}>
                      <TableCell>
                        <Input type="number" value={rank.sort_order} className="w-16" onChange={(e) => updateRank(rank.id, 'sort_order', parseInt(e.target.value) || 0)} onBlur={() => fetchRanks()} />
                      </TableCell>
                      <TableCell>
                        <Input value={rank.name} onChange={(e) => {
                          setRanks(prev => prev.map(r => r.id === rank.id ? { ...r, name: e.target.value } : r));
                        }} onBlur={(e) => updateRank(rank.id, 'name', e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={rank.min_hours} className="w-24" onChange={(e) => {
                          setRanks(prev => prev.map(r => r.id === rank.id ? { ...r, min_hours: parseFloat(e.target.value) || 0 } : r));
                        }} onBlur={(e) => updateRank(rank.id, 'min_hours', parseFloat(e.target.value) || 0)} />
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteRank(rank.id, rank.name)}>
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
