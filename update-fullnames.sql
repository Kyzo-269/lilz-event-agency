-- ============================================================
-- LIL'Z EVENT AGENCY — update-fullnames.sql
-- Met à jour les full_name de tous les profils
-- ============================================================

UPDATE profiles p
SET full_name = mapping.full_name
FROM (
  VALUES
    ('zaahir@lilz.com',                  'Zaahir'),
    ('chefprojet@lilz.com',              'Chef de Projet'),
    ('communitymanager@lilz.com',        'Community Manager'),
    ('sitemanager@lilz.com',             'Site Manager'),
    ('advisor@lilz.com',                 'Advisor'),
    ('responsablefinancier@lilz.com',    'Responsable Financier'),
    ('eventplanner@lilz.com',            'Event Planner'),
    ('regisseur1@lilz.com',              'Régisseur 1'),
    ('regisseur2@lilz.com',              'Régisseur 2'),
    ('regisseur3@lilz.com',              'Régisseur 3'),
    ('regisseur4@lilz.com',              'Régisseur 4'),
    ('kyliancheikhahmed17@gmail.com',    'Kylian')
) AS mapping(email, full_name)
JOIN auth.users u ON lower(u.email) = lower(mapping.email)
WHERE p.id = u.id;

-- Vérification
SELECT u.email, p.full_name, p.role
FROM auth.users u
JOIN profiles p ON p.id = u.id
ORDER BY p.full_name;
