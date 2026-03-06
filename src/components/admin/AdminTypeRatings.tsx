import { useState, useEffect } from "react";
import { Award, Plus, Trash2, RefreshCw } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TypeRatingRow {
  id: string;
  user_id: string;
  is_active: boolean;
  acquired_at: string;
  aircraft: { id: string; name: string; type_code: string; family: string };
  profile?: { callsign: string; name: string } | null;
}

export function AdminTypeRatings() {
  const [ratings, setRatings] = useState<TypeRatingRow[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; callsign: string; name: string }[]>([]);
  const [aircraftTypes, setAircraftTypes] = useState<{ id: string; name: string; type_code: string; family: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ user_id: '', aircraft_id: '' });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [ratingsRes, profilesRes, aircraftRes] = await Promise.all([
      supabase.from('type_ratings').select('id, user_id, is_active, acquired_at, aircraft:aircraft(id, name, type_code, family)').order('acquired_at', { ascending: false }).limit(200),
      supabase.from('profiles').select('user_id, callsign, name').order('callsign'),
      supabase.from('aircraft').select('id, name, type_code, family').order('family'),
    ]);

    const rData = (ratingsRes.data || []) as any[];
    // Attach profile info
    const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
    const enriched = rData.map(r => ({ ...r, profile: profileMap.get(r.user_id) || null }));
    setRatings(enriched);
    setProfiles(profilesRes.data || []);
    setAircraftTypes(aircraftRes.data || []);
    setLoading(false);
  };

  const addRating = async () => {
    if (!form.user_id || !form.aircraft_id) {
      toast.error('Select both pilot and aircraft');
      return;
    }
    const { error } = await supabase.from('type_ratings').insert({
      user_id: form.user_id,
      aircraft_id: form.aircraft_id,
      is_active: false,
    });
    if (error) {
      if (error.code === '23505') toast.error('Pilot already has this type rating');
      else toast.error(error.message);
    } else {
      toast.success('Type rating granted');
      setAddOpen(false);
      setForm({ user_id: '', aircraft_id: '' });
      fetchAll();
    }
  };

  const deleteRating = async (id: string) => {
    const { error } = await supabase.from('type_ratings').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Type rating removed'); fetchAll(); }
  };

  if (loading) {
    return (
      <SectionCard title="Type Ratings" icon={<Award className="h-5 w-5 text-muted-foreground" />}>
        <div className="flex items-center justify-center py-8">
          <Award className="h-6 w-6 animate-pulse text-primary" />
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Type Ratings Management" icon={<Award className="h-5 w-5 text-muted-foreground" />} className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{ratings.length} type ratings assigned</p>
        <div className="flex gap-2">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Grant Type Rating</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Grant Type Rating</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Pilot</Label>
                  <Select value={form.user_id} onValueChange={v => setForm(p => ({ ...p, user_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select pilot" /></SelectTrigger>
                    <SelectContent>
                      {profiles.map(p => (
                        <SelectItem key={p.user_id} value={p.user_id}>{p.callsign} - {p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select></div>
                <div><Label>Aircraft</Label>
                  <Select value={form.aircraft_id} onValueChange={v => setForm(p => ({ ...p, aircraft_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select aircraft" /></SelectTrigger>
                    <SelectContent>
                      {aircraftTypes.map(ac => (
                        <SelectItem key={ac.id} value={ac.id}>{ac.name} ({ac.type_code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select></div>
                <Button onClick={addRating} className="w-full">Grant Rating</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={fetchAll} className="gap-2">
            <RefreshCw className="h-4 w-4" />Refresh
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pilot</TableHead>
              <TableHead>Aircraft</TableHead>
              <TableHead>Family</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Granted</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ratings.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium text-primary">
                  {r.profile ? `${r.profile.callsign} (${r.profile.name})` : r.user_id.slice(0, 8)}
                </TableCell>
                <TableCell>{r.aircraft?.name || '-'} ({r.aircraft?.type_code})</TableCell>
                <TableCell>{r.aircraft?.family || '-'}</TableCell>
                <TableCell>{r.is_active ? '✅' : '⚪'}</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {new Date(r.acquired_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                    onClick={() => deleteRating(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}
