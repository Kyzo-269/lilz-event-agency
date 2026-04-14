-- ============================================================
-- LIL'Z EVENT AGENCY — fix-final.sql
-- Exécuter dans Supabase → SQL Editor (en une seule fois)
-- Corrige TOUTES les tables et les buckets Storage
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. PROFILS (doit exister avant toutes les FK)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id              uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name       text,
  role            text,
  email           text,
  last_seen       timestamptz,
  statut_presence text DEFAULT 'Hors ligne',
  avatar_url      text,
  created_at      timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 2. ÉVÉNEMENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evenements (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom         text NOT NULL,
  date        date NOT NULL,
  lieu        text NOT NULL,
  description text,
  statut      text DEFAULT 'En préparation',
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 3. CHECKLIST ÉVÉNEMENT
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_checklist (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id      uuid REFERENCES evenements(id) ON DELETE CASCADE,
  texte         text NOT NULL,
  done          boolean DEFAULT false,
  status        text DEFAULT 'todo',
  assignee_id   uuid REFERENCES profiles(id),
  assignee_name text,
  created_by    uuid REFERENCES profiles(id),
  created_at    timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 4. PHOTOS ÉVÉNEMENT (galerie)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_photos (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id    uuid REFERENCES evenements(id) ON DELETE CASCADE,
  url         text NOT NULL,
  uploaded_by uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 5. MESSAGES DIRECTS (chat privé)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS direct_messages (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id   uuid REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content     text NOT NULL DEFAULT '',
  media_url   text,
  media_type  text,   -- 'image' | 'audio' | NULL
  read_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dm_sender   ON direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_dm_receiver ON direct_messages(receiver_id);

-- ────────────────────────────────────────────────────────────
-- 6. NOTES INTERNES (messagerie équipe)
--    ⚠️ Le code utilise "notes_internes", PAS "notes"
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes_internes (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id     uuid REFERENCES profiles(id) ON DELETE CASCADE,
  author_name   text NOT NULL DEFAULT '',
  author_role   text,
  content       text NOT NULL DEFAULT '',
  is_urgent     boolean DEFAULT false,
  is_pinned     boolean DEFAULT false,
  reply_to      uuid REFERENCES notes_internes(id) ON DELETE SET NULL,
  reply_preview text,
  audio_url     text,
  image_url     text,
  created_at    timestamptz DEFAULT now()
);

-- Réactions aux notes
CREATE TABLE IF NOT EXISTS note_reactions (
  id       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id  uuid REFERENCES notes_internes(id) ON DELETE CASCADE,
  user_id  uuid REFERENCES profiles(id) ON DELETE CASCADE,
  emoji    text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (note_id, user_id, emoji)
);

-- ────────────────────────────────────────────────────────────
-- 7. PLANNING
--    ⚠️ Schéma corrigé — user_id NOT NULL requis par le code
-- ────────────────────────────────────────────────────────────
-- Si la table existe déjà avec l'ancien schéma, on la recrée
DROP TABLE IF EXISTS planning CASCADE;

CREATE TABLE planning (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES profiles(id),
  assigne_id   uuid REFERENCES profiles(id),
  assigne_nom  text,
  assigne_role text,
  poste        text,
  date         date,
  heure_debut  text,
  heure_fin    text,
  notes        text,
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 8. BILLETTERIE
--    ⚠️ Schéma corrigé — le code utilise client_name/nb_personnes
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS tickets CASCADE;

CREATE TABLE tickets (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name  text NOT NULL,
  nb_personnes integer DEFAULT 1,
  statut       text DEFAULT 'En attente',
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 9. FINANCES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finances (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type       text NOT NULL,      -- 'Recette' | 'Dépense'
  libelle    text NOT NULL,
  montant    numeric NOT NULL,
  categorie  text,
  date       date NOT NULL,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 10. MATÉRIEL TECHNIQUE
--     ⚠️ Nouveau schéma — remplace l'ancienne table "materiel"
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS materiel_technique (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type       text NOT NULL CHECK (type IN ('prevu', 'a_prevoir')),
  nom        text NOT NULL,
  categorie  text DEFAULT 'Son',
  quantite   integer DEFAULT 1,
  etat       text,        -- 'OK'|'Manquant'|'Fragile'|'Usé'|'À réparer'
  priorite   text,        -- 'Urgent'|'Normal'|'Optionnel'
  note       text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 11. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE evenements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_checklist   ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_photos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes_internes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_reactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE finances          ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiel_technique ENABLE ROW LEVEL SECURITY;

-- Policies (DROP avant recréation pour éviter les doublons)
DO $$ BEGIN

  -- profiles
  DROP POLICY IF EXISTS "profiles_all" ON profiles;
  CREATE POLICY "profiles_all" ON profiles FOR ALL
    USING (auth.role() = 'authenticated');

  -- evenements
  DROP POLICY IF EXISTS "evenements_auth" ON evenements;
  CREATE POLICY "evenements_auth" ON evenements FOR ALL
    USING (auth.role() = 'authenticated');

  -- event_checklist
  DROP POLICY IF EXISTS "checklist_auth" ON event_checklist;
  CREATE POLICY "checklist_auth" ON event_checklist FOR ALL
    USING (auth.role() = 'authenticated');

  -- event_photos
  DROP POLICY IF EXISTS "photos_auth" ON event_photos;
  CREATE POLICY "photos_auth" ON event_photos FOR ALL
    USING (auth.role() = 'authenticated');

  -- direct_messages : chacun voit ses propres messages
  DROP POLICY IF EXISTS "dm_own" ON direct_messages;
  CREATE POLICY "dm_own" ON direct_messages FOR ALL
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

  -- notes_internes
  DROP POLICY IF EXISTS "notes_auth" ON notes_internes;
  CREATE POLICY "notes_auth" ON notes_internes FOR ALL
    USING (auth.role() = 'authenticated');

  -- note_reactions
  DROP POLICY IF EXISTS "reactions_auth" ON note_reactions;
  CREATE POLICY "reactions_auth" ON note_reactions FOR ALL
    USING (auth.role() = 'authenticated');

  -- planning
  DROP POLICY IF EXISTS "planning_auth" ON planning;
  CREATE POLICY "planning_auth" ON planning FOR ALL
    USING (auth.role() = 'authenticated');

  -- tickets
  DROP POLICY IF EXISTS "tickets_auth" ON tickets;
  CREATE POLICY "tickets_auth" ON tickets FOR ALL
    USING (auth.role() = 'authenticated');

  -- finances : CEO et Responsable Financier uniquement
  DROP POLICY IF EXISTS "finances_auth"   ON finances;
  DROP POLICY IF EXISTS "finances_select" ON finances;
  DROP POLICY IF EXISTS "finances_write"  ON finances;

  CREATE POLICY "finances_select" ON finances
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role IN ('CEO', 'Responsable Financier')
      )
    );

  CREATE POLICY "finances_write" ON finances
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role IN ('CEO', 'Responsable Financier')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role IN ('CEO', 'Responsable Financier')
      )
    );

  -- materiel_technique
  DROP POLICY IF EXISTS "materiel_auth" ON materiel_technique;
  CREATE POLICY "materiel_auth" ON materiel_technique FOR ALL
    USING (auth.role() = 'authenticated');

END $$;

-- ────────────────────────────────────────────────────────────
-- 12. REALTIME
-- ────────────────────────────────────────────────────────────
-- Activer le Realtime dans Supabase → Database → Replication
-- Tables à cocher : direct_messages, profiles, notes_internes, planning

-- ────────────────────────────────────────────────────────────
-- 13. STORAGE — Buckets
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('event-gallery',      'event-gallery',      true, 52428800,
   ARRAY['image/jpeg','image/png','image/gif','image/webp','image/heic','image/heif']),
  ('chat-private-media', 'chat-private-media', true, 52428800,
   ARRAY['image/jpeg','image/png','image/gif','image/webp','audio/webm','audio/mp4','audio/ogg','audio/mpeg']),
  ('chat-media',         'chat-media',         true, 52428800,
   ARRAY['image/jpeg','image/png','image/gif','image/webp','audio/webm','audio/mp4','audio/ogg'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ────────────────────────────────────────────────────────────
-- 14. STORAGE — Policies
-- ────────────────────────────────────────────────────────────

-- Lecture publique (images accessibles sans auth)
DROP POLICY IF EXISTS "public_read_gallery"  ON storage.objects;
DROP POLICY IF EXISTS "public_read_chat_priv" ON storage.objects;
DROP POLICY IF EXISTS "public_read_chat"     ON storage.objects;

CREATE POLICY "public_read_gallery" ON storage.objects
  FOR SELECT USING (bucket_id = 'event-gallery');

CREATE POLICY "public_read_chat_priv" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-private-media');

CREATE POLICY "public_read_chat" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-media');

-- Upload pour membres authentifiés
DROP POLICY IF EXISTS "auth_upload_all" ON storage.objects;
CREATE POLICY "auth_upload_all" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id IN ('event-gallery', 'chat-private-media', 'chat-media')
    AND auth.role() = 'authenticated'
  );

-- Suppression pour membres authentifiés
DROP POLICY IF EXISTS "auth_delete_all" ON storage.objects;
CREATE POLICY "auth_delete_all" ON storage.objects
  FOR DELETE USING (
    bucket_id IN ('event-gallery', 'chat-private-media', 'chat-media')
    AND auth.role() = 'authenticated'
  );

-- ────────────────────────────────────────────────────────────
-- FIN — Tout est prêt
-- ────────────────────────────────────────────────────────────
