-- ================================================================
-- NOUVELLES FEATURES — LIL'Z EVENT AGENCY
-- À coller dans : Supabase > SQL Editor > New Query > Run
-- Exécuter APRÈS migration-finale.sql
-- ================================================================

-- ── 1. Colonne last_seen dans profiles ─────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

-- Autoriser les utilisateurs à mettre à jour leur propre last_seen
-- (la policy profiles_update_own existante couvre déjà cela)

-- ── 2. Table ÉVÉNEMENTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evenements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom         TEXT NOT NULL,
  date        DATE NOT NULL,
  lieu        TEXT NOT NULL,
  description TEXT,
  statut      TEXT NOT NULL DEFAULT 'En préparation'
              CHECK (statut IN ('En préparation','Confirmé','En cours','Terminé')),
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Trigger updated_at pour evenements
DROP TRIGGER IF EXISTS set_updated_at ON public.evenements;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.evenements
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ── 3. RLS pour evenements ─────────────────────────────────────
ALTER TABLE public.evenements ENABLE ROW LEVEL SECURITY;

-- Lecture pour tous les membres authentifiés
DROP POLICY IF EXISTS "events_select" ON public.evenements;
CREATE POLICY "events_select"
  ON public.evenements FOR SELECT
  TO authenticated
  USING (true);

-- Écriture pour CEO, Chef de Projet, Event Planner
DROP POLICY IF EXISTS "events_write" ON public.evenements;
CREATE POLICY "events_write"
  ON public.evenements FOR ALL
  TO authenticated
  USING (
    public.get_my_role() IN ('CEO', 'Chef de Projet Événementiel', 'Event Planner')
  )
  WITH CHECK (
    public.get_my_role() IN ('CEO', 'Chef de Projet Événementiel', 'Event Planner')
  );

-- ── 4. Realtime : activer les publications temps réel ──────────
-- (à faire dans Supabase Dashboard > Database > Replication)
-- Activer pour les tables : notes_internes, evenements
-- Ou via SQL :
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes_internes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.evenements;

-- ── 5. Vérification (affiche les tables créées) ────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
