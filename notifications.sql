-- À exécuter une fois dans Supabase > SQL Editor.
-- Hypothèse : la fonction ma_session() (déjà utilisée par la page) renvoie
-- {statut, role, etudiant_id, admin_id} pour le jeton de la requête en cours.

create table if not exists public.appareils (
  jeton       text primary key,
  role        text not null check (role in ('admin','etudiant')),
  etudiant_id text,
  admin_id    text,
  plateforme  text default 'android',
  maj         timestamptz default now()
);
alter table public.appareils enable row level security;  -- aucun accès direct

create or replace function public.enregistrer_appareil(p_jeton text, p_plateforme text default 'android')
returns void language plpgsql security definer set search_path = public as $$
declare s jsonb;
begin
  s := ma_session()::jsonb;
  if coalesce(s->>'statut','') <> 'ok' then raise exception 'session invalide'; end if;
  insert into appareils(jeton, role, etudiant_id, admin_id, plateforme, maj)
  values (p_jeton, s->>'role', s->>'etudiant_id', s->>'admin_id', p_plateforme, now())
  on conflict (jeton) do update
    set role = excluded.role, etudiant_id = excluded.etudiant_id,
        admin_id = excluded.admin_id, maj = now();
end $$;

create or replace function public.supprimer_appareil(p_jeton text)
returns void language plpgsql security definer set search_path = public as $$
declare s jsonb;
begin
  s := ma_session()::jsonb;
  if coalesce(s->>'statut','') <> 'ok' then return; end if;
  delete from appareils
   where jeton = p_jeton
     and (etudiant_id is not distinct from s->>'etudiant_id')
     and (admin_id    is not distinct from s->>'admin_id');
end $$;

grant execute on function public.enregistrer_appareil(text,text) to anon, authenticated;
grant execute on function public.supprimer_appareil(text)        to anon, authenticated;
