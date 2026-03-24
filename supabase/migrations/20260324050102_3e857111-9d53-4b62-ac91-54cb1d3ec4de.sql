-- Add discord_id and discord_username to profiles for Discord bot linking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS discord_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS discord_username text;

-- Create ranks table for admin-manageable rank criteria
CREATE TABLE IF NOT EXISTS public.ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  min_hours numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ranks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ranks" ON public.ranks FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Ranks viewable by authenticated" ON public.ranks FOR SELECT TO authenticated USING (true);

-- Seed default ranks
INSERT INTO public.ranks (name, min_hours, sort_order) VALUES
  ('Cadet', 0, 0),
  ('First Officer', 40, 1),
  ('Captain', 80, 2),
  ('Commander', 150, 3),
  ('Vladimir', 250, 4)
ON CONFLICT DO NOTHING;