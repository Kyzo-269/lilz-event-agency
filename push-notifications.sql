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
  user_agent text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

-- RLS activé
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Supprimer toutes les anciennes policies (clean slate)
DROP POLICY IF EXISTS "push_own"        ON push_subscriptions;
DROP POLICY IF EXISTS "push_read_auth"  ON push_subscriptions;
DROP POLICY IF EXISTS "push_select"     ON push_subscriptions;
DROP POLICY IF EXISTS "push_insert"     ON push_subscriptions;
DROP POLICY IF EXISTS "push_update"     ON push_subscriptions;
DROP POLICY IF EXISTS "push_delete"     ON push_subscriptions;

-- SELECT : tout membre authentifié peut lire tous les abonnements
--          (nécessaire pour envoyer des notifs aux autres membres)
CREATE POLICY "push_select" ON push_subscriptions
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- INSERT : chaque membre peut créer SES propres abonnements
--          WITH CHECK obligatoire pour les INSERT sous Supabase
CREATE POLICY "push_insert" ON push_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE : chaque membre peut modifier SES propres abonnements
CREATE POLICY "push_update" ON push_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE : chaque membre peut supprimer SES propres abonnements
CREATE POLICY "push_delete" ON push_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Vérification : affiche les policies actives
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'push_subscriptions'
ORDER BY cmd;
