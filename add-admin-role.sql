-- ============================================================
-- LIL'Z EVENT AGENCY — add-admin-role.sql
-- Ajoute le rôle Admin avec les mêmes droits que CEO
-- Exécuter dans Supabase → SQL Editor
-- ============================================================

-- 1. Mise à jour du type ENUM role dans profiles (si utilisé)
-- Ajouter 'Admin' à la liste des rôles valides
-- Note: si la colonne role est de type TEXT (sans contrainte), pas besoin

-- Si votre colonne role a une contrainte CHECK, ajoutez 'Admin' :
-- ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
-- ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
--   CHECK (role IN ('CEO', 'Admin', 'Chef de Projet Événementiel', 'Community Manager',
--                  'Site Manager', 'Advisor', 'Responsable Financier', 'Event Planner',
--                  'Régisseur de production 1', 'Régisseur de production 2',
--                  'Régisseur de production 3', 'Régisseur de production 4'));

-- 2. Mise à jour des policies RLS sur la table finances
--    Admin = mêmes droits que CEO

-- Supprimer les anciennes policies finances
DROP POLICY IF EXISTS "finances_select" ON finances;
DROP POLICY IF EXISTS "finances_insert" ON finances;
DROP POLICY IF EXISTS "finances_update" ON finances;
DROP POLICY IF EXISTS "finances_delete" ON finances;
-- Anciennes policies génériques
DROP POLICY IF EXISTS "finances_own"   ON finances;
DROP POLICY IF EXISTS "finances_auth"  ON finances;

-- SELECT : CEO, Admin et Responsable Financier uniquement
CREATE POLICY "finances_select" ON finances
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('CEO', 'Admin', 'Responsable Financier')
    )
  );

-- INSERT : CEO, Admin et Responsable Financier uniquement
CREATE POLICY "finances_insert" ON finances
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('CEO', 'Admin', 'Responsable Financier')
    )
  );

-- UPDATE : CEO, Admin et Responsable Financier uniquement
CREATE POLICY "finances_update" ON finances
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('CEO', 'Admin', 'Responsable Financier')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('CEO', 'Admin', 'Responsable Financier')
    )
  );

-- DELETE : CEO, Admin et Responsable Financier uniquement
CREATE POLICY "finances_delete" ON finances
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('CEO', 'Admin', 'Responsable Financier')
    )
  );

-- 3. Vérification
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'finances'
ORDER BY cmd;
