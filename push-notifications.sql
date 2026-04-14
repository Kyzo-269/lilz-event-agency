-- ============================================================
-- LIL'Z EVENT AGENCY — push-notifications.sql
-- Exécuter dans Supabase → SQL Editor
-- ============================================================

-- Table des abonnements push (une ligne par navigateur/appareil)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint   text NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  user_agent text,              -- pour identifier l'appareil (optionnel)
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, endpoint)    -- un seul enregistrement par abonnement
);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Chaque membre peut gérer ses propres abonnements
DROP POLICY IF EXISTS "push_own" ON push_subscriptions;
CREATE POLICY "push_own" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Les membres authentifiés peuvent LIRE les abonnements des autres
-- (nécessaire pour envoyer des notifications côté client)
DROP POLICY IF EXISTS "push_read_auth" ON push_subscriptions;
CREATE POLICY "push_read_auth" ON push_subscriptions
  FOR SELECT USING (auth.role() = 'authenticated');
