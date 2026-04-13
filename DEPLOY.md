# 🚀 Guide de déploiement — LIL'Z EVENT AGENCY

## Table des matières
1. [Prérequis](#prérequis)
2. [Configuration Supabase](#configuration-supabase)
3. [Déploiement Vercel](#déploiement-vercel)
4. [PWA iPhone (iOS)](#pwa-iphone)
5. [Notifications Push sur iPhone](#notifications-push-iphone)
6. [Checklist finale](#checklist-finale)

---

## 1. Prérequis

- Compte [Vercel](https://vercel.com) (gratuit)
- Projet Supabase déjà configuré
- Node.js 18+ installé en local
- Git installé

---

## 2. Configuration Supabase

### 2.1 Tables SQL à créer

> **IMPORTANT** : Utiliser **`fix-final.sql`** (à la racine du projet) — il contient toutes les tables correctes et les buckets Storage. C'est le seul fichier SQL à exécuter.

Exécuter dans **Supabase → SQL Editor** :

```sql
-- ── Profils utilisateurs ──────────────────────────────────────
-- (Normalement déjà créée)
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

-- ── Événements ────────────────────────────────────────────────
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

-- ── Checklist événement ───────────────────────────────────────
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

-- ── Photos événement (galerie) ────────────────────────────────
CREATE TABLE IF NOT EXISTS event_photos (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id    uuid REFERENCES evenements(id) ON DELETE CASCADE,
  url         text NOT NULL,
  uploaded_by uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);

-- ── Messages directs (chat privé) ─────────────────────────────
CREATE TABLE IF NOT EXISTS direct_messages (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id   uuid REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content     text NOT NULL DEFAULT '',
  media_url   text,
  media_type  text,        -- 'image' | 'audio' | NULL
  read_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dm_sender   ON direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_dm_receiver ON direct_messages(receiver_id);

-- ── Notes / messagerie équipe ─────────────────────────────────
-- (Si la table notes n'existe pas encore)
CREATE TABLE IF NOT EXISTS notes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contenu     text NOT NULL,
  auteur_id   uuid REFERENCES profiles(id),
  auteur_nom  text,
  is_urgent   boolean DEFAULT false,
  is_pinned   boolean DEFAULT false,
  reactions   jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

-- ── Planning ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planning (
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

-- ── Billetterie ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom_client  text NOT NULL,
  email       text,
  telephone   text,
  type        text DEFAULT 'Standard',
  statut      text DEFAULT 'Confirmé',
  montant     numeric DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- ── Finances ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finances (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type      text NOT NULL,     -- 'Recette' | 'Dépense'
  libelle   text NOT NULL,
  montant   numeric NOT NULL,
  categorie text,
  date      date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ── Matériel (inventaire avancé) ─────────────────────────────
CREATE TABLE IF NOT EXISTS materiel_technique (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type        text NOT NULL CHECK (type IN ('prevu', 'a_prevoir')),
  nom         text NOT NULL,
  categorie   text DEFAULT 'Son',
  quantite    integer DEFAULT 1,
  etat        text,
  priorite    text,
  note        text,
  created_by  uuid REFERENCES profiles(id),
  updated_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);
```

### 2.2 Row Level Security (RLS)

```sql
-- Activer RLS sur toutes les tables sensibles
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_photos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiel_technique  ENABLE ROW LEVEL SECURITY;

-- Profiles : chacun voit tout (équipe interne)
CREATE POLICY "profiles_all" ON profiles FOR ALL
  USING (auth.role() = 'authenticated');

-- Messages : chacun voit ses propres messages
CREATE POLICY "dm_own" ON direct_messages FOR ALL
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Photos : tous les membres authentifiés
CREATE POLICY "photos_auth" ON event_photos FOR ALL
  USING (auth.role() = 'authenticated');

-- Toutes les autres tables : accès équipe connectée
CREATE POLICY "all_authenticated" ON evenements     FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "all_authenticated" ON event_checklist FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "all_authenticated" ON notes           FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "all_authenticated" ON planning        FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "all_authenticated" ON tickets         FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "all_authenticated" ON finances        FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "all_authenticated" ON materiel_technique FOR ALL USING (auth.role() = 'authenticated');
```

### 2.3 Realtime

Activer le Realtime sur les tables dans **Supabase → Database → Replication** :
- ✅ `direct_messages`
- ✅ `profiles`
- ✅ `notes`
- ✅ `planning`

### 2.4 Buckets Storage

Dans **Supabase → Storage → New bucket** :

| Bucket | Public | Usage |
|--------|--------|-------|
| `event-gallery` | ✅ Public | Photos des événements |
| `chat-private-media` | ✅ Public | Photos et vocaux du chat |

Politiques pour chaque bucket (Storage → Policies) :
```sql
-- Lecture publique
CREATE POLICY "public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'event-gallery');

-- Upload pour les membres connectés
CREATE POLICY "auth upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id IN ('event-gallery', 'chat-private-media')
    AND auth.role() = 'authenticated'
  );

-- Suppression pour les membres connectés
CREATE POLICY "auth delete" ON storage.objects
  FOR DELETE USING (
    bucket_id IN ('event-gallery', 'chat-private-media')
    AND auth.role() = 'authenticated'
  );
```

### 2.5 Créer les utilisateurs

Dans **Supabase → Authentication → Users** :
1. Cliquer "Invite user" pour chaque membre de l'équipe
2. Après l'inscription, compléter manuellement dans la table `profiles` :
   - `full_name` : Prénom + Nom
   - `role` : Ex : CEO, Event Planner, etc.

---

## 3. Déploiement Vercel

### Étape 1 — Pousser le code sur GitHub

```bash
git init
git add .
git commit -m "Initial commit — LIL'Z EVENT AGENCY"
git branch -M main
git remote add origin https://github.com/VOTRE_USERNAME/lilz-event-agency.git
git push -u origin main
```

### Étape 2 — Importer sur Vercel

1. Aller sur [vercel.com/new](https://vercel.com/new)
2. Cliquer **"Import Git Repository"**
3. Sélectionner le dépôt `lilz-event-agency`
4. Framework : **Next.js** (détecté automatiquement)
5. **Ne pas cliquer Deploy** tout de suite

### Étape 3 — Variables d'environnement Vercel

Dans **Vercel → Project Settings → Environment Variables**, ajouter :

| Variable | Valeur | Environnements |
|----------|--------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `votre_anon_key` | Production, Preview, Development |

### Étape 4 — Déployer

Cliquer **Deploy**. Le déploiement prend 2-3 minutes.

### Étape 5 — Domaine personnalisé (optionnel)

Dans **Vercel → Project → Domains** :
- Ajouter `app.lilzeventagency.fr` ou votre domaine
- Suivre les instructions DNS

### Étape 6 — Ajouter le domaine dans Supabase

Dans **Supabase → Authentication → URL Configuration** :
- Site URL : `https://votre-app.vercel.app`
- Redirect URLs : `https://votre-app.vercel.app/**`

---

## 4. PWA iPhone

### Installer l'app sur iPhone

1. Ouvrir Safari sur iPhone
2. Aller sur `https://votre-app.vercel.app`
3. Appuyer sur le bouton **Partager** (carré avec flèche)
4. Sélectionner **"Sur l'écran d'accueil"**
5. Nommer l'app **"LIL'Z"** → Ajouter

### Prérequis iOS

- iOS 16.4 minimum pour les notifications push
- Safari uniquement (Chrome/Firefox iOS ne supportent pas les PWA)
- L'app doit être installée (pas juste ouverte dans Safari)

---

## 5. Notifications Push sur iPhone

> ⚠️ Les notifications push en arrière-plan nécessitent iOS 16.4+ et l'app doit être installée sur l'écran d'accueil.

### Étape 1 — Générer les clés VAPID

```bash
npm install -g web-push
web-push generate-vapid-keys
```

Cela génère :
```
Public Key:  Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Private Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Étape 2 — Variables d'environnement

Ajouter dans Vercel (et dans `.env.local`) :
```
VAPID_PUBLIC_KEY=votre_cle_publique
VAPID_PRIVATE_KEY=votre_cle_privee
VAPID_SUBJECT=mailto:contact@lilzeventagency.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=votre_cle_publique
```

### Étape 3 — Table push_subscriptions dans Supabase

```sql
CREATE TABLE push_subscriptions (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint   text NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_sub" ON push_subscriptions FOR ALL USING (auth.uid() = user_id);
```

### Étape 4 — Route API d'envoi de notification

Créer `src/app/api/push/route.ts` :
```typescript
import webpush from 'web-push';
import { NextRequest, NextResponse } from 'next/server';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: NextRequest) {
  const { subscription, payload } = await req.json();
  await webpush.sendNotification(subscription, JSON.stringify(payload));
  return NextResponse.json({ ok: true });
}
```

### Étape 5 — Abonnement côté client

Dans le chat, après réception d'un message, s'abonner aux push :
```typescript
const reg = await navigator.serviceWorker.ready;
const sub = await reg.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
});
// Sauvegarder sub dans Supabase push_subscriptions
```

> **Note** : Pour les besoins actuels de l'équipe interne, les notifications dans l'app (son + badge) fonctionnent sans VAPID. Les push en arrière-plan sont une amélioration future.

---

## 6. Checklist finale

### Avant déploiement

- [ ] Variables d'environnement dans `.env.local` et Vercel
- [ ] Toutes les tables SQL créées dans Supabase
- [ ] RLS activé sur les tables sensibles
- [ ] Buckets `event-gallery` et `chat-private-media` créés et publics
- [ ] Realtime activé sur `direct_messages`, `profiles`, `notes`
- [ ] URL de redirection Supabase configurée avec le domaine Vercel
- [ ] Au moins un utilisateur créé dans Supabase Auth + profil renseigné

### Après déploiement

- [ ] Tester la connexion sur iPhone Safari
- [ ] Installer la PWA sur l'écran d'accueil
- [ ] Tester l'envoi d'un message entre deux membres
- [ ] Tester l'upload de photo (galerie événement + chat)
- [ ] Tester le mode hors ligne (page `/offline` s'affiche)
- [ ] Vérifier le badge de messages non lus
- [ ] Tester la génération de PDF rapport

---

## Variables d'environnement résumé

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Clé publique Supabase |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 🔶 Push uniquement | Clé VAPID publique |
| `VAPID_PUBLIC_KEY` | 🔶 Push uniquement | Clé VAPID publique (serveur) |
| `VAPID_PRIVATE_KEY` | 🔶 Push uniquement | Clé VAPID privée (serveur, **NE PAS exposer**) |
| `VAPID_SUBJECT` | 🔶 Push uniquement | `mailto:votre@email.com` |

---

*Développée par **Kylian Cheikh Ahmed** — Chaque instant marque l'histoire*
