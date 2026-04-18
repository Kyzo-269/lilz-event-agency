-- ============================================================
-- FIX : RLS policies table "planning"
-- Problème : les employés ne voyaient pas les postes du CEO
-- Solution : SELECT ouvert à tous les membres authentifiés
--            WRITE étendu au rôle Admin
-- ============================================================

-- 1. Lecture : TOUS les membres authentifiés voient TOUS les postes
DROP POLICY IF EXISTS "planning_select" ON public.planning;
CREATE POLICY "planning_select"
  ON public.planning FOR SELECT
  TO authenticated
  USING (true);

-- 2. Écriture : CEO, Admin, Chef de Projet, Site Manager
DROP POLICY IF EXISTS "planning_write" ON public.planning;
CREATE POLICY "planning_write"
  ON public.planning FOR ALL
  TO authenticated
  USING (
    public.get_my_role() IN ('CEO', 'Admin', 'Chef de Projet Événementiel', 'Site Manager')
  )
  WITH CHECK (
    public.get_my_role() IN ('CEO', 'Admin', 'Chef de Projet Événementiel', 'Site Manager')
  );
