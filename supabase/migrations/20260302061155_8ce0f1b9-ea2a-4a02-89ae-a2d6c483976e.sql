
ALTER TABLE public.route_catalog ADD COLUMN IF NOT EXISTS livery text;

-- Migrate existing "code" data to "livery" before dropping
UPDATE public.route_catalog SET livery = code WHERE code IS NOT NULL AND livery IS NULL;

ALTER TABLE public.route_catalog DROP COLUMN IF EXISTS code;
ALTER TABLE public.route_catalog DROP COLUMN IF EXISTS dep_city;
ALTER TABLE public.route_catalog DROP COLUMN IF EXISTS arr_city;
ALTER TABLE public.route_catalog DROP COLUMN IF EXISTS rank_required;
