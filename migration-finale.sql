-- ================================================================
-- MIGRATION FINALE — LIL'Z EVENT AGENCY
-- À coller dans : Supabase > SQL Editor > New Query > Run
-- Ordre d'exécution : ce fichier en une seule fois
-- ================================================================

-- ── 0. Extension UUID ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. PROFILES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'Event Planner' CHECK (role IN (
    'CEO', 'Chef de Projet Événementiel', 'Community Manager',
    'Site Manager', 'Advisor', 'Responsable Financier', 'Event Planner',
    'Régisseur de production 1', 'Régisseur de production 2',
    'Régisseur de production 3', 'Régisseur de production 4'
  )),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Trigger : crée le profil automatiquement à chaque inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'Event Planner')
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Fonction utilitaire RLS : récupère le rôle de l'utilisateur courant
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ── 2. BILLETTERIE ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tickets (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_name  TEXT NOT NULL,
  nb_personnes INTEGER NOT NULL CHECK (nb_personnes > 0),
  statut       TEXT NOT NULL DEFAULT 'En attente' CHECK (statut IN (
    'En attente', 'Confirmée', 'Présent', 'No-show', 'Annulée'
  )),
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Si la table existait déjà avec l'ancienne contrainte, on la met à jour
DO $$ BEGIN
  ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_statut_check;
  ALTER TABLE public.tickets ADD CONSTRAINT tickets_statut_check
    CHECK (statut IN ('En attente', 'Confirmée', 'Présent', 'No-show', 'Annulée'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Supprime l'ancienne colonne event_name si elle existe
ALTER TABLE public.tickets DROP COLUMN IF EXISTS event_name;

-- ── 3. MATÉRIEL TECHNIQUE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.materiel_technique (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type        TEXT NOT NULL CHECK (type IN ('prevu', 'a_prevoir')),
  nom         TEXT NOT NULL,
  categorie   TEXT NOT NULL CHECK (categorie IN ('Son','Lumière','Décor','Mobilier','Scène','Autre')),
  quantite    INTEGER NOT NULL DEFAULT 1 CHECK (quantite > 0),
  etat        TEXT CHECK (etat IN ('OK','Manquant','Fragile','Usé','À réparer')),
  priorite    TEXT CHECK (priorite IN ('Urgent','Normal','Optionnel')),
  note        TEXT,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ── 4. PLANNING ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.planning (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assigne_nom   TEXT NOT NULL,
  assigne_role  TEXT NOT NULL,
  poste         TEXT NOT NULL,
  date          DATE NOT NULL,
  heure_debut   TIME NOT NULL,
  heure_fin     TIME NOT NULL,
  notes         TEXT,
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ── 5. NOTES INTERNES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notes_internes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name  TEXT NOT NULL,
  author_role  TEXT NOT NULL,
  content      TEXT NOT NULL,
  is_urgent    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ── 6. FINANCES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.finances (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  libelle     TEXT NOT NULL,
  montant     NUMERIC(12,2) NOT NULL CHECK (montant > 0),
  type        TEXT NOT NULL CHECK (type IN ('Recette','Dépense')),
  categorie   TEXT NOT NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ── 7. TRIGGER updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','tickets','materiel_technique'] LOOP
    EXECUTE FORMAT('
      DROP TRIGGER IF EXISTS set_updated_at ON public.%I;
      CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
      FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
    ', t, t);
  END LOOP;
END $$;

-- ── 8. ROW LEVEL SECURITY ──────────────────────────────────────
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiel_technique ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes_internes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finances         ENABLE ROW LEVEL SECURITY;

-- PROFILES
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- TICKETS : tout le monde lit, tout le monde écrit (sauf suppression)
DROP POLICY IF EXISTS "tickets_select" ON public.tickets;
CREATE POLICY "tickets_select" ON public.tickets FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "tickets_insert" ON public.tickets;
CREATE POLICY "tickets_insert" ON public.tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "tickets_update" ON public.tickets;
CREATE POLICY "tickets_update" ON public.tickets FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "tickets_delete" ON public.tickets;
CREATE POLICY "tickets_delete" ON public.tickets FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.get_my_role() IN ('CEO','Chef de Projet Événementiel'));

-- MATÉRIEL : lecture pour tous, écriture pour Régisseurs + CEO
DROP POLICY IF EXISTS "mat_select" ON public.materiel_technique;
CREATE POLICY "mat_select" ON public.materiel_technique FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "mat_write" ON public.materiel_technique;
CREATE POLICY "mat_write" ON public.materiel_technique FOR ALL TO authenticated
  USING (public.get_my_role() IN ('CEO','Régisseur de production 1','Régisseur de production 2','Régisseur de production 3','Régisseur de production 4'))
  WITH CHECK (public.get_my_role() IN ('CEO','Régisseur de production 1','Régisseur de production 2','Régisseur de production 3','Régisseur de production 4'));

-- PLANNING : lecture pour tous, écriture pour CEO + Chef de Projet + Site Manager
DROP POLICY IF EXISTS "planning_select" ON public.planning;
CREATE POLICY "planning_select" ON public.planning FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "planning_write" ON public.planning;
CREATE POLICY "planning_write" ON public.planning FOR ALL TO authenticated
  USING (public.get_my_role() IN ('CEO','Chef de Projet Événementiel','Site Manager'))
  WITH CHECK (public.get_my_role() IN ('CEO','Chef de Projet Événementiel','Site Manager'));

-- NOTES : lecture pour tous, écriture propre à chacun
DROP POLICY IF EXISTS "notes_select" ON public.notes_internes;
CREATE POLICY "notes_select" ON public.notes_internes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "notes_insert" ON public.notes_internes;
CREATE POLICY "notes_insert" ON public.notes_internes FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "notes_delete_own" ON public.notes_internes;
CREATE POLICY "notes_delete_own" ON public.notes_internes FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- FINANCES : ACCÈS STRICT CEO + Responsable Financier
DROP POLICY IF EXISTS "finances_restricted" ON public.finances;
CREATE POLICY "finances_restricted" ON public.finances FOR ALL TO authenticated
  USING (public.get_my_role() IN ('CEO','Responsable Financier'))
  WITH CHECK (public.get_my_role() IN ('CEO','Responsable Financier'));

-- ── 9. Mise à jour manuelle du rôle (exemple) ──────────────────
-- Après avoir créé un utilisateur dans Supabase Auth, exécute :
-- UPDATE public.profiles SET role = 'CEO', full_name = 'Ton Nom' WHERE email = 'tonemail@...';
-- UPDATE public.profiles SET role = 'Régisseur de production 1', full_name = 'Prénom NOM' WHERE email = '...';
