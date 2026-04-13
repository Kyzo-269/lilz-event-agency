-- ============================================================
-- SCHÉMA COMPLET — LIL'Z EVENT AGENCY
-- À coller dans : Supabase > SQL Editor > New Query
-- ============================================================

-- ============================================================
-- 1. EXTENSION UUID (déjà activée par défaut sur Supabase)
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- 2. TABLE PROFILES (liée à auth.users de Supabase)
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null,
  role        text not null check (role in (
    'CEO',
    'Chef de Projet Événementiel',
    'Community Manager',
    'Site Manager',
    'Advisor',
    'Responsable Financier',
    'Event Planner',
    'Régisseur de production 1',
    'Régisseur de production 2',
    'Régisseur de production 3',
    'Régisseur de production 4'
  )),
  avatar_url  text,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

-- Trigger : crée automatiquement un profil à chaque nouvel utilisateur
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'Event Planner')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 3. TABLE BILLETTERIE
-- ============================================================
create table if not exists public.tickets (
  id           uuid primary key default uuid_generate_v4(),
  event_name   text not null,
  client_name  text not null,
  nb_personnes integer not null check (nb_personnes > 0),
  statut       text not null default 'En attente' check (statut in ('Confirmé', 'En attente', 'Annulé')),
  notes        text,
  created_by   uuid not null references public.profiles(id) on delete set null,
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null
);

-- ============================================================
-- 4. TABLE MATÉRIEL TECHNIQUE
-- ============================================================
create table if not exists public.materiels (
  id          uuid primary key default uuid_generate_v4(),
  nom         text not null,
  description text,
  etat        text not null default 'OK' check (etat in ('Manquant', 'Fragile', 'Usé', 'À réparer', 'OK')),
  quantite    integer not null default 1 check (quantite >= 0),
  updated_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

-- ============================================================
-- 5. TABLE PLANNING
-- ============================================================
create table if not exists public.planning (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  poste       text not null,
  date        date not null,
  heure_debut time not null,
  heure_fin   time not null,
  notes       text,
  created_by  uuid not null references public.profiles(id) on delete set null,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

-- ============================================================
-- 6. TABLE NOTES INTERNES (messagerie d'équipe)
-- ============================================================
create table if not exists public.notes (
  id          uuid primary key default uuid_generate_v4(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  content     text not null,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

-- ============================================================
-- 7. TABLE FINANCES (accès restreint CEO + Responsable Financier)
-- ============================================================
create table if not exists public.finances (
  id          uuid primary key default uuid_generate_v4(),
  libelle     text not null,
  montant     numeric(12, 2) not null check (montant > 0),
  type        text not null check (type in ('Recette', 'Dépense')),
  categorie   text not null,
  date        date not null default current_date,
  created_by  uuid not null references public.profiles(id) on delete set null,
  created_at  timestamptz default now() not null
);

-- ============================================================
-- 8. TRIGGER updated_at automatique (toutes les tables)
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Applique le trigger sur chaque table avec updated_at
do $$
declare
  t text;
begin
  foreach t in array array['profiles','tickets','materiels','planning','notes'] loop
    execute format('
      drop trigger if exists set_updated_at on public.%I;
      create trigger set_updated_at
        before update on public.%I
        for each row execute procedure public.set_updated_at();
    ', t, t);
  end loop;
end;
$$;

-- ============================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Active RLS sur toutes les tables
alter table public.profiles  enable row level security;
alter table public.tickets   enable row level security;
alter table public.materiels enable row level security;
alter table public.planning  enable row level security;
alter table public.notes     enable row level security;
alter table public.finances  enable row level security;

-- Fonction utilitaire : récupère le rôle de l'utilisateur courant
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- --------------------------
-- PROFILES : chacun voit son profil + les autres membres de l'équipe
-- --------------------------
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
  on public.profiles for select
  to authenticated
  using (true);  -- tous les membres voient le répertoire équipe

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- --------------------------
-- TICKETS : lecture pour tous, écriture pour tous les authentifiés
-- --------------------------
drop policy if exists "tickets_select" on public.tickets;
create policy "tickets_select"
  on public.tickets for select
  to authenticated
  using (true);

drop policy if exists "tickets_insert" on public.tickets;
create policy "tickets_insert"
  on public.tickets for insert
  to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "tickets_update" on public.tickets;
create policy "tickets_update"
  on public.tickets for update
  to authenticated
  using (true);

drop policy if exists "tickets_delete" on public.tickets;
create policy "tickets_delete"
  on public.tickets for delete
  to authenticated
  using (
    auth.uid() = created_by
    or public.get_my_role() in ('CEO', 'Chef de Projet Événementiel')
  );

-- --------------------------
-- MATÉRIEL : lecture pour tous, écriture UNIQUEMENT pour les Régisseurs + CEO
-- --------------------------
drop policy if exists "materiels_select" on public.materiels;
create policy "materiels_select"
  on public.materiels for select
  to authenticated
  using (true);

drop policy if exists "materiels_write" on public.materiels;
create policy "materiels_write"
  on public.materiels for all
  to authenticated
  using (
    public.get_my_role() in (
      'Régisseur de production 1',
      'Régisseur de production 2',
      'Régisseur de production 3',
      'Régisseur de production 4',
      'CEO'
    )
  )
  with check (
    public.get_my_role() in (
      'Régisseur de production 1',
      'Régisseur de production 2',
      'Régisseur de production 3',
      'Régisseur de production 4',
      'CEO'
    )
  );

-- --------------------------
-- PLANNING : lecture pour tous, écriture pour CEO + Chef de Projet
-- --------------------------
drop policy if exists "planning_select" on public.planning;
create policy "planning_select"
  on public.planning for select
  to authenticated
  using (true);

drop policy if exists "planning_write" on public.planning;
create policy "planning_write"
  on public.planning for all
  to authenticated
  using (
    public.get_my_role() in ('CEO', 'Chef de Projet Événementiel', 'Site Manager')
  )
  with check (
    public.get_my_role() in ('CEO', 'Chef de Projet Événementiel', 'Site Manager')
  );

-- --------------------------
-- NOTES : lecture et écriture pour tous les membres
-- --------------------------
drop policy if exists "notes_select" on public.notes;
create policy "notes_select"
  on public.notes for select
  to authenticated
  using (true);

drop policy if exists "notes_insert" on public.notes;
create policy "notes_insert"
  on public.notes for insert
  to authenticated
  with check (auth.uid() = author_id);

drop policy if exists "notes_update_own" on public.notes;
create policy "notes_update_own"
  on public.notes for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "notes_delete_own" on public.notes;
create policy "notes_delete_own"
  on public.notes for delete
  to authenticated
  using (auth.uid() = author_id);

-- --------------------------
-- FINANCES : ACCÈS STRICT — CEO + Responsable Financier UNIQUEMENT
-- --------------------------
drop policy if exists "finances_restricted" on public.finances;
create policy "finances_restricted"
  on public.finances for all
  to authenticated
  using (
    public.get_my_role() in ('CEO', 'Responsable Financier')
  )
  with check (
    public.get_my_role() in ('CEO', 'Responsable Financier')
  );

-- ============================================================
-- 10. DONNÉES DE TEST (optionnel — supprime si non nécessaire)
-- ============================================================
-- Note : les utilisateurs doivent d'abord être créés via
-- Supabase Auth (Authentication > Users > Add user)
-- puis leurs profils seront créés automatiquement par le trigger.

-- Exemple de mise à jour de rôle après création :
-- update public.profiles set role = 'CEO', full_name = 'Ton Nom' where email = 'tonemail@test.com';
