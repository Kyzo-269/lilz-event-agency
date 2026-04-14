-- ============================================================
-- LIL'Z EVENT AGENCY — setup-profiles.sql
-- Exécuter dans Supabase → SQL Editor
--
-- 1. Crée les lignes manquantes dans profiles pour chaque
--    utilisateur Supabase Auth
-- 2. Met à jour les rôles et emails selon la liste officielle
-- 3. Corrige la RLS finances (CEO + Responsable Financier only)
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- ÉTAPE 1 — Initialiser les profils manquants
-- (pour les users Auth qui n'ont pas encore de ligne profiles)
-- ────────────────────────────────────────────────────────────
INSERT INTO profiles (id, email, full_name, role, created_at)
SELECT
  u.id,
  u.email,
  split_part(u.email, '@', 1),   -- nom temporaire = préfixe email
  'Équipe',                       -- rôle par défaut
  now()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = u.id
);


-- ────────────────────────────────────────────────────────────
-- ÉTAPE 2 — Mise à jour des rôles par email
-- ────────────────────────────────────────────────────────────
UPDATE profiles p
SET
  role  = mapping.role,
  email = mapping.email
FROM (
  VALUES
    ('zaahir@lilz.com',                'CEO'),
    ('chefprojet@lilz.com',            'Chef de Projet Événementiel'),
    ('communitymanager@lilz.com',      'Community Manager'),
    ('sitemanager@lilz.com',           'Site Manager'),
    ('advisor@lilz.com',               'Advisor'),
    ('responsablefinancier@lilz.com',  'Responsable Financier'),
    ('eventplanner@lilz.com',          'Event Planner'),
    ('regisseur1@lilz.com',            'Régisseur de production 1'),
    ('regisseur2@lilz.com',            'Régisseur de production 2'),
    ('regisseur3@lilz.com',            'Régisseur de production 3'),
    ('regisseur4@lilz.com',            'Régisseur de production 4')
) AS mapping(email, role)
JOIN auth.users u ON lower(u.email) = lower(mapping.email)
WHERE p.id = u.id;


-- ────────────────────────────────────────────────────────────
-- ÉTAPE 3 — Mise à jour du full_name pour le CEO
-- (les autres membres devront compléter leur nom manuellement
--  ou via Supabase Dashboard → Table Editor → profiles)
-- ────────────────────────────────────────────────────────────
UPDATE profiles p
SET full_name = 'Zaahir'
FROM auth.users u
WHERE p.id = u.id
  AND lower(u.email) = 'zaahir@lilz.com'
  AND (p.full_name IS NULL OR p.full_name = split_part(u.email, '@', 1));


-- ────────────────────────────────────────────────────────────
-- ÉTAPE 4 — Vérification (affiche le résultat)
-- ────────────────────────────────────────────────────────────
SELECT
  u.email,
  p.full_name,
  p.role,
  CASE
    WHEN p.role IS NOT NULL AND p.role != 'Équipe' THEN '✓ OK'
    ELSE '⚠ Rôle non assigné'
  END AS statut
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
ORDER BY
  CASE p.role
    WHEN 'CEO'                         THEN 1
    WHEN 'Chef de Projet Événementiel' THEN 2
    WHEN 'Responsable Financier'       THEN 3
    WHEN 'Community Manager'           THEN 4
    WHEN 'Site Manager'                THEN 5
    WHEN 'Advisor'                     THEN 6
    WHEN 'Event Planner'               THEN 7
    ELSE 8
  END;


-- ────────────────────────────────────────────────────────────
-- ÉTAPE 5 — RLS Finances : CEO + Responsable Financier only
--
-- Remplace la policy permissive "tous authentifiés" par une
-- policy qui vérifie le rôle dans la table profiles.
-- ────────────────────────────────────────────────────────────
ALTER TABLE finances ENABLE ROW LEVEL SECURITY;

-- Supprimer l'ancienne policy trop permissive
DROP POLICY IF EXISTS "finances_auth"  ON finances;
DROP POLICY IF EXISTS "finances_roles" ON finances;

-- Lecture (SELECT) : CEO et Responsable Financier uniquement
CREATE POLICY "finances_select" ON finances
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id   = auth.uid()
        AND profiles.role IN ('CEO', 'Responsable Financier')
    )
  );

-- Écriture (INSERT/UPDATE/DELETE) : idem
CREATE POLICY "finances_write" ON finances
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id   = auth.uid()
        AND profiles.role IN ('CEO', 'Responsable Financier')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id   = auth.uid()
        AND profiles.role IN ('CEO', 'Responsable Financier')
    )
  );


-- ────────────────────────────────────────────────────────────
-- FIN
-- ────────────────────────────────────────────────────────────
-- Pour compléter les full_name des autres membres :
--
-- UPDATE profiles p
-- SET full_name = 'Prénom Nom'
-- FROM auth.users u
-- WHERE p.id = u.id AND u.email = 'email@lilz.com';
-- ────────────────────────────────────────────────────────────
