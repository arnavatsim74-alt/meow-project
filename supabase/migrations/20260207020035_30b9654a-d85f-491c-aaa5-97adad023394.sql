
-- Create saved flight plans table
CREATE TABLE public.saved_flight_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ofp_id TEXT NOT NULL,
  callsign TEXT,
  flight_number TEXT,
  origin_icao TEXT NOT NULL,
  destination_icao TEXT NOT NULL,
  alternate_icao TEXT,
  aircraft_type TEXT,
  aircraft_reg TEXT,
  route TEXT,
  cruise_altitude TEXT,
  block_fuel TEXT,
  est_time_enroute TEXT,
  distance_nm TEXT,
  pax_count TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_flight_plans ENABLE ROW LEVEL SECURITY;

-- Users can view their own saved flight plans
CREATE POLICY "Users can view own saved flight plans"
  ON public.saved_flight_plans FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own saved flight plans
CREATE POLICY "Users can insert own saved flight plans"
  ON public.saved_flight_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own saved flight plans
CREATE POLICY "Users can delete own saved flight plans"
  ON public.saved_flight_plans FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can manage all saved flight plans
CREATE POLICY "Admins can manage saved flight plans"
  ON public.saved_flight_plans FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
