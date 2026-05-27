-- ==========================================
-- SUPABASE SCHEMA - DIGITAL SUPPORT DASHBOARD
-- ==========================================

-- Enable Row Level Security (RLS) or setup policies as needed.
-- For a local or custom setup, let's keep it simple or configure standard RLS.

-- 1. Create table for User Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    role TEXT CHECK (role IN ('super_admin', 'coordinator', 'support_it')) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default roles (Super Admin and Coordinator as requested)
INSERT INTO public.user_roles (email, role)
VALUES 
('sanchezmanuel397@gmail.com', 'super_admin'),
('ajgarcia@ucema.edu.ar', 'coordinator')
ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role;

-- 2. Create table for Directivas
CREATE TABLE IF NOT EXISTS public.directives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom TEXT CHECK (classroom IN ('4D', '4E', '5E', 'Lab Movil 1', 'Lab Movil 2', 'Lab Movil 3')) NOT NULL,
    directive_date DATE NOT NULL DEFAULT CURRENT_DATE,
    requirements TEXT NOT NULL,
    created_by_email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime for directives
ALTER TABLE public.directives REPLICA IDENTITY FULL;

-- 3. Create table for Observaciones
CREATE TABLE IF NOT EXISTS public.observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('info', 'warning', 'danger')) DEFAULT 'info' NOT NULL,
    created_by_email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime for observations
ALTER TABLE public.observations REPLICA IDENTITY FULL;

-- 4. Create table for Fixed Calendar Events (Almanaque Fijo)
CREATE TABLE IF NOT EXISTS public.fixed_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week TEXT CHECK (day_of_week IN ('Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes')) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    time_range TEXT NOT NULL,
    created_by_email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime for fixed_events
ALTER TABLE public.fixed_events REPLICA IDENTITY FULL;

-- 5. Create table for custom OTP verification codes (Resend flow)
CREATE TABLE IF NOT EXISTS public.otp_codes (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add Supabase Publication for Realtime replication
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.directives, public.observations, public.fixed_events;
COMMIT;
