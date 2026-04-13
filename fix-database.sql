-- ================================================================
-- FIX DATABASE — LIL'Z EVENT AGENCY
-- À coller EN ENTIER dans : Supabase > SQL Editor > New Query > Run
-- Safe à exécuter plusieurs fois (idempotent)
-- ================================================================

-- ── 0. Extension UUID ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. Fonction utilitaire RLS ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ── 2. Fonction trigger updated_at ────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- ================================================================
-- TABLE PROFILES
-- Ajoute les colonnes manquantes sans toucher aux données
-- ================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS statut_presence TEXT
    DEFAULT 'Hors ligne'
    CHECK (statut_presence IN ('Disponible','Sur scène','En pause','En déplacement','Hors ligne'));

-- RLS profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select"      ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"  ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ================================================================
-- TABLE TICKETS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.tickets (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_name  TEXT NOT NULL,
  nb_personnes INTEGER NOT NULL CHECK (nb_personnes > 0),
  statut       TEXT NOT NULL DEFAULT 'En attente' CHECK (statut IN (
                 'En attente','Confirmée','Présent','No-show','Annulée')),
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Met à jour la contrainte si elle est ancienne
DO $$ BEGIN
  ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_statut_check;
  ALTER TABLE public.tickets ADD CONSTRAINT tickets_statut_check
    CHECK (statut IN ('En attente','Confirmée','Présent','No-show','Annulée'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Supprime l'ancienne colonne event_name si elle existe encore
ALTER TABLE public.tickets DROP COLUMN IF EXISTS event_name;

-- Trigger
DROP TRIGGER IF EXISTS set_updated_at ON public.tickets;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- RLS tickets
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tickets_select" ON public.tickets;
DROP POLICY IF EXISTS "tickets_insert" ON public.tickets;
DROP POLICY IF EXISTS "tickets_update" ON public.tickets;
DROP POLICY IF EXISTS "tickets_delete" ON public.tickets;

CREATE POLICY "tickets_select" ON public.tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "tickets_insert" ON public.tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "tickets_update" ON public.tickets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "tickets_delete" ON public.tickets FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.get_my_role() IN ('CEO','Chef de Projet Événementiel'));

-- ================================================================
-- TABLE MATÉRIEL TECHNIQUE
-- ================================================================
CREATE TABLE IF NOT EXISTS public.materiel_technique (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type       TEXT NOT NULL CHECK (type IN ('prevu','a_prevoir')),
  nom        TEXT NOT NULL,
  categorie  TEXT NOT NULL CHECK (categorie IN ('Son','Lumière','Décor','Mobilier','Scène','Autre')),
  quantite   INTEGER NOT NULL DEFAULT 1 CHECK (quantite > 0),
  etat       TEXT CHECK (etat IN ('OK','Manquant','Fragile','Usé','À réparer')),
  priorite   TEXT CHECK (priorite IN ('Urgent','Normal','Optionnel')),
  note       TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Trigger
DROP TRIGGER IF EXISTS set_updated_at ON public.materiel_technique;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.materiel_technique
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- RLS matériel
ALTER TABLE public.materiel_technique ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mat_select" ON public.materiel_technique;
DROP POLICY IF EXISTS "mat_write"  ON public.materiel_technique;

CREATE POLICY "mat_select" ON public.materiel_technique FOR SELECT TO authenticated USING (true);
CREATE POLICY "mat_write"  ON public.materiel_technique FOR ALL TO authenticated
  USING (public.get_my_role() IN ('CEO','Régisseur de production 1','Régisseur de production 2','Régisseur de production 3','Régisseur de production 4'))
  WITH CHECK (public.get_my_role() IN ('CEO','Régisseur de production 1','Régisseur de production 2','Régisseur de production 3','Régisseur de production 4'));

-- ================================================================
-- TABLE PLANNING
-- Ajoute les colonnes assigne_nom / assigne_role si elles manquent
-- ================================================================
CREATE TABLE IF NOT EXISTS public.planning (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assigne_nom  TEXT,
  assigne_role TEXT,
  poste        TEXT NOT NULL,
  date         DATE NOT NULL,
  heure_debut  TIME NOT NULL,
  heure_fin    TIME NOT NULL,
  notes        TEXT,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Si la table existait déjà (ancienne structure avec user_id), on ajoute les colonnes
ALTER TABLE public.planning ADD COLUMN IF NOT EXISTS assigne_nom  TEXT;
ALTER TABLE public.planning ADD COLUMN IF NOT EXISTS assigne_role TEXT;

-- Supprime l'ancienne colonne user_id si elle existe (optionnel — ne bloque pas le code)
-- ALTER TABLE public.planning DROP COLUMN IF EXISTS user_id;  ← décommenter si voulu

-- RLS planning
ALTER TABLE public.planning ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planning_select" ON public.planning;
DROP POLICY IF EXISTS "planning_write"  ON public.planning;

CREATE POLICY "planning_select" ON public.planning FOR SELECT TO authenticated USING (true);
CREATE POLICY "planning_write"  ON public.planning FOR ALL TO authenticated
  USING (public.get_my_role() IN ('CEO','Chef de Projet Événementiel','Site Manager'))
  WITH CHECK (public.get_my_role() IN ('CEO','Chef de Projet Événementiel','Site Manager'));

-- ================================================================
-- TABLE NOTES INTERNES
-- ================================================================
CREATE TABLE IF NOT EXISTS public.notes_internes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name  TEXT NOT NULL,
  author_role  TEXT NOT NULL,
  content      TEXT NOT NULL,
  is_urgent    BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned    BOOLEAN NOT NULL DEFAULT FALSE,
  reply_to     UUID REFERENCES public.notes_internes(id) ON DELETE SET NULL,
  reply_preview TEXT,
  audio_url    TEXT,
  image_url    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Ajoute les colonnes manquantes si la table existait déjà sans elles
ALTER TABLE public.notes_internes ADD COLUMN IF NOT EXISTS is_pinned     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.notes_internes ADD COLUMN IF NOT EXISTS reply_to      UUID REFERENCES public.notes_internes(id) ON DELETE SET NULL;
ALTER TABLE public.notes_internes ADD COLUMN IF NOT EXISTS reply_preview TEXT;
ALTER TABLE public.notes_internes ADD COLUMN IF NOT EXISTS audio_url     TEXT;
ALTER TABLE public.notes_internes ADD COLUMN IF NOT EXISTS image_url     TEXT;

-- RLS notes
ALTER TABLE public.notes_internes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notes_select"      ON public.notes_internes;
DROP POLICY IF EXISTS "notes_insert"      ON public.notes_internes;
DROP POLICY IF EXISTS "notes_update_own"  ON public.notes_internes;
DROP POLICY IF EXISTS "notes_delete_own"  ON public.notes_internes;

CREATE POLICY "notes_select"     ON public.notes_internes FOR SELECT TO authenticated USING (true);
CREATE POLICY "notes_insert"     ON public.notes_internes FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "notes_update_own" ON public.notes_internes FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "notes_delete_own" ON public.notes_internes FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- ================================================================
-- TABLE RÉACTIONS EMOJI (notes)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.note_reactions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id    UUID NOT NULL REFERENCES public.notes_internes(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(note_id, user_id, emoji)
);

ALTER TABLE public.note_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reactions_select" ON public.note_reactions;
DROP POLICY IF EXISTS "reactions_insert" ON public.note_reactions;
DROP POLICY IF EXISTS "reactions_delete" ON public.note_reactions;

CREATE POLICY "reactions_select" ON public.note_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "reactions_insert" ON public.note_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "reactions_delete" ON public.note_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ================================================================
-- TABLE FINANCES
-- ================================================================
CREATE TABLE IF NOT EXISTS public.finances (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  libelle    TEXT NOT NULL,
  montant    NUMERIC(12,2) NOT NULL CHECK (montant > 0),
  type       TEXT NOT NULL CHECK (type IN ('Recette','Dépense')),
  categorie  TEXT NOT NULL,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.finances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finances_restricted" ON public.finances;

CREATE POLICY "finances_restricted" ON public.finances FOR ALL TO authenticated
  USING (public.get_my_role() IN ('CEO','Responsable Financier'))
  WITH CHECK (public.get_my_role() IN ('CEO','Responsable Financier'));

-- ================================================================
-- TABLE ÉVÉNEMENTS
-- ================================================================
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

-- Trigger
DROP TRIGGER IF EXISTS set_updated_at ON public.evenements;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.evenements
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.evenements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_select" ON public.evenements;
DROP POLICY IF EXISTS "events_write"  ON public.evenements;

CREATE POLICY "events_select" ON public.evenements FOR SELECT TO authenticated USING (true);
CREATE POLICY "events_write"  ON public.evenements FOR ALL TO authenticated
  USING (public.get_my_role() IN ('CEO','Chef de Projet Événementiel','Event Planner'))
  WITH CHECK (public.get_my_role() IN ('CEO','Chef de Projet Événementiel','Event Planner'));

-- ================================================================
-- TABLE CHECKLIST ÉVÉNEMENTS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.event_checklist (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id   UUID NOT NULL REFERENCES public.evenements(id) ON DELETE CASCADE,
  texte      TEXT NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.event_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checklist_select"        ON public.event_checklist;
DROP POLICY IF EXISTS "checklist_insert_delete" ON public.event_checklist;
DROP POLICY IF EXISTS "checklist_update_done"   ON public.event_checklist;

CREATE POLICY "checklist_select"        ON public.event_checklist FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklist_insert_delete" ON public.event_checklist FOR ALL TO authenticated
  USING (public.get_my_role() IN ('CEO','Chef de Projet Événementiel','Event Planner'))
  WITH CHECK (public.get_my_role() IN ('CEO','Chef de Projet Événementiel','Event Planner'));
CREATE POLICY "checklist_update_done"   ON public.event_checklist FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- ================================================================
-- STORAGE — Bucket chat-media (messages vocaux + photos)
-- ================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media', 'chat-media', true, 52428800,
  ARRAY['audio/webm','audio/ogg','audio/mp4','image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat_media_insert" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_select" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_delete" ON storage.objects;

CREATE POLICY "chat_media_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media');
CREATE POLICY "chat_media_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-media');
CREATE POLICY "chat_media_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ================================================================
-- REALTIME — Activer les tables en temps réel
-- ================================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notes_internes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.evenements;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.note_reactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.event_checklist;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ================================================================
-- TRIGGER — Créer profil automatiquement à l'inscription
-- ================================================================
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

-- ================================================================
-- VÉRIFICATION FINALE — Affiche toutes les tables créées
-- ================================================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
