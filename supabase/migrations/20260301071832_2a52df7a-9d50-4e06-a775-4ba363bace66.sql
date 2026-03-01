
-- Departure bases table (curated list for Site Settings)
CREATE TABLE public.departure_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  icao_code text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.departure_bases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage departure bases" ON public.departure_bases FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Departure bases viewable by authenticated" ON public.departure_bases FOR SELECT TO authenticated USING (true);

-- Add route_type and rank_required to route_catalog
ALTER TABLE public.route_catalog ADD COLUMN IF NOT EXISTS route_type text DEFAULT 'passenger';
ALTER TABLE public.route_catalog ADD COLUMN IF NOT EXISTS rank_required text DEFAULT 'first_officer';

-- Add departure_base and routing_rule to career_requests
ALTER TABLE public.career_requests ADD COLUMN IF NOT EXISTS departure_base text;
ALTER TABLE public.career_requests ADD COLUMN IF NOT EXISTS routing_rule text DEFAULT 'return_to_base';

-- Seed some default departure bases
INSERT INTO public.departure_bases (icao_code, name) VALUES
  ('UUEE', 'Moscow Sheremetyevo'),
  ('UUDD', 'Moscow Domodedovo'),
  ('ULLI', 'Saint Petersburg Pulkovo'),
  ('OMDB', 'Dubai International'),
  ('EGLL', 'London Heathrow')
ON CONFLICT (icao_code) DO NOTHING;
