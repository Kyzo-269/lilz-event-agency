-- ================================================================
-- NOUVELLES FEATURES v2 — LIL'Z EVENT AGENCY
-- À coller dans : Supabase > SQL Editor > New Query > Run
-- Exécuter APRÈS migration-finale.sql ET nouvelles-features.sql
-- ================================================================

-- ── 1. Statut de présence dans profiles ────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS statut_presence TEXT
    NOT NULL DEFAULT 'Hors ligne'
    CHECK (statut_presence IN ('Disponible','Sur scène','En pause','En déplacement','Hors ligne'));

-- ── 2. Nouvelles colonnes notes_internes ───────────────────────
ALTER TABLE public.notes_internes
  ADD COLUMN IF NOT EXISTS reply_to      UUID REFERENCES public.notes_internes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reply_preview TEXT,
  ADD COLUMN IF NOT EXISTS is_pinned     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS audio_url     TEXT,
  ADD COLUMN IF NOT EXISTS image_url     TEXT;

-- ── 3. Table réactions emoji ───────────────────────────────────
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
CREATE POLICY "reactions_select"
  ON public.note_reactions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "reactions_insert" ON public.note_reactions;
CREATE POLICY "reactions_insert"
  ON public.note_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "reactions_delete" ON public.note_reactions;
CREATE POLICY "reactions_delete"
  ON public.note_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── 4. Table checklist événements ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_checklist (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id   UUID NOT NULL REFERENCES public.evenements(id) ON DELETE CASCADE,
  texte      TEXT NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.event_checklist ENABLE ROW LEVEL SECURITY;

-- Lecture pour tous les membres
DROP POLICY IF EXISTS "checklist_select" ON public.event_checklist;
CREATE POLICY "checklist_select"
  ON public.event_checklist FOR SELECT TO authenticated USING (true);

-- Ajout/suppression : CEO, Chef de Projet, Event Planner
DROP POLICY IF EXISTS "checklist_insert_delete" ON public.event_checklist;
CREATE POLICY "checklist_insert_delete"
  ON public.event_checklist FOR ALL TO authenticated
  USING (public.get_my_role() IN ('CEO','Chef de Projet Événementiel','Event Planner'))
  WITH CHECK (public.get_my_role() IN ('CEO','Chef de Projet Événementiel','Event Planner'));

-- Cocher/décocher : tous les membres authentifiés
DROP POLICY IF EXISTS "checklist_update_done" ON public.event_checklist;
CREATE POLICY "checklist_update_done"
  ON public.event_checklist FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- ── 5. Bucket Supabase Storage (chat-media) ───────────────────
-- Crée le bucket pour les messages vocaux et photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  true,
  52428800, -- 50 MB max
  ARRAY['audio/webm','audio/ogg','audio/mp4','image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Politique : upload pour membres authentifiés
DROP POLICY IF EXISTS "chat_media_insert" ON storage.objects;
CREATE POLICY "chat_media_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media');

-- Politique : lecture publique
DROP POLICY IF EXISTS "chat_media_select" ON storage.objects;
CREATE POLICY "chat_media_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-media');

-- Politique : suppression par auteur
DROP POLICY IF EXISTS "chat_media_delete" ON storage.objects;
CREATE POLICY "chat_media_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ── 6. Realtime : activer les nouvelles tables ─────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.note_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_checklist;

-- Profiles déjà dans la publication ? Sinon décommenter :
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- ── 7. Vérification ────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
