-- =====================================================================
--  BRIGATA — database Supabase
--  Incolla tutto in Supabase → SQL Editor → New query → Run.
--  Si può rieseguire: non cancella i dati esistenti.
-- =====================================================================

-- ---------- Tabelle ----------

create table if not exists public.restaurants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ruoli: owner = titolare, manager = responsabile, cook = cuoco
create table if not exists public.members (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null check (role in ('owner','manager','cook')),
  name          text not null default '',
  joined_at     timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);
create index if not exists members_user_idx on public.members(user_id);

create table if not exists public.invites (
  code          text primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  role          text not null check (role in ('manager','cook')),
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '7 days',
  max_uses      int not null default 20,
  uses          int not null default 0
);

-- Tutti i dati dell'app: una riga per elemento (ricetta, lettura di temperatura, prodotto…)
--   coll = tipo di dato, id = id dell'elemento, data = contenuto
create table if not exists public.items (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  coll          text not null,
  id            text not null,
  data          jsonb not null default '{}'::jsonb,
  deleted       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid,
  primary key (restaurant_id, coll, id)
);
create index if not exists items_sync_idx on public.items(restaurant_id, updated_at);

-- Registro attività: chi ha fatto cosa e quando (solo aggiunte, non si modifica)
create table if not exists public.activity (
  id            uuid primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id       uuid default auth.uid(),
  user_name     text not null default '',
  kind          text not null default '',
  text          text not null default '',
  at            timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index if not exists activity_idx on public.activity(restaurant_id, at desc);

-- Menù pubblico per il QR (solo nomi dei piatti e allergeni)
create table if not exists public.public_menus (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  slug          text not null unique,
  data          jsonb not null,
  published     boolean not null default true,
  updated_at    timestamptz not null default now()
);

-- ---------- Funzioni di supporto ----------

create or replace function public.my_role(rid uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.members where restaurant_id = rid and user_id = auth.uid()
$$;

-- tipi di dato che anche un cuoco può scrivere
create or replace function public.cook_can_write(c text) returns boolean
language sql immutable as $$
  select c in ('log','done','lots','pren','pr','sp','nt','tv','sc','bc')
$$;

create or replace function public.can_write_item(rid uuid, c text, is_update boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.my_role(rid)
    when 'owner'   then true
    when 'manager' then true
    when 'cook'    then public.cook_can_write(c) and not (is_update and c = 'log')
    else false end
$$;

create or replace function public.items_stamp() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  if tg_op = 'UPDATE' then new.created_at := old.created_at; end if;
  return new;
end $$;
drop trigger if exists items_stamp on public.items;
create trigger items_stamp before insert or update on public.items
  for each row execute function public.items_stamp();

create or replace function public.menus_stamp() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists menus_stamp on public.public_menus;
create trigger menus_stamp before insert or update on public.public_menus
  for each row execute function public.menus_stamp();

-- ---------- Funzioni chiamate dall'app ----------

create or replace function public.create_restaurant(p_name text, p_my_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if auth.uid() is null then raise exception 'Serve un account'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Scrivi il nome del locale'; end if;
  insert into public.restaurants(name, created_by) values (trim(p_name), auth.uid()) returning id into rid;
  insert into public.members(restaurant_id, user_id, role, name) values (rid, auth.uid(), 'owner', coalesce(trim(p_my_name), ''));
  return rid;
end $$;

create or replace function public.create_invite(p_rid uuid, p_role text) returns text
language plpgsql security definer set search_path = public as $$
declare r text := public.my_role(p_rid); c text; abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  if r is null or r = 'cook' then raise exception 'Non hai i permessi per invitare'; end if;
  if p_role not in ('manager','cook') then raise exception 'Ruolo non valido'; end if;
  if r = 'manager' and p_role <> 'cook' then raise exception 'Un responsabile può invitare solo cuochi'; end if;
  loop
    c := '';
    for i in 1..6 loop c := c || substr(abc, 1 + floor(random() * length(abc))::int, 1); end loop;
    begin
      insert into public.invites(code, restaurant_id, role, created_by) values (c, p_rid, p_role, auth.uid());
      return c;
    exception when unique_violation then -- riprova con un altro codice
    end;
  end loop;
end $$;

create or replace function public.join_restaurant(p_code text, p_my_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv public.invites;
begin
  if auth.uid() is null then raise exception 'Serve un account'; end if;
  select * into inv from public.invites where code = upper(trim(p_code)) for update;
  if not found then raise exception 'Codice non valido'; end if;
  if exists (select 1 from public.members where restaurant_id = inv.restaurant_id and user_id = auth.uid()) then
    return inv.restaurant_id;
  end if;
  if inv.expires_at < now() then raise exception 'Codice scaduto: chiedine uno nuovo'; end if;
  if inv.uses >= inv.max_uses then raise exception 'Codice esaurito: chiedine uno nuovo'; end if;
  insert into public.members(restaurant_id, user_id, role, name) values (inv.restaurant_id, auth.uid(), inv.role, coalesce(trim(p_my_name), ''));
  update public.invites set uses = uses + 1 where code = inv.code;
  return inv.restaurant_id;
end $$;

create or replace function public.my_restaurants()
returns table(restaurant_id uuid, name text, role text, my_name text)
language sql stable security definer set search_path = public as $$
  select r.id, r.name, m.role, m.name
  from public.members m join public.restaurants r on r.id = m.restaurant_id
  where m.user_id = auth.uid()
  order by m.joined_at
$$;

create or replace function public.set_my_name(p_rid uuid, p_name text) returns void
language sql security definer set search_path = public as $$
  update public.members set name = coalesce(trim(p_name), '') where restaurant_id = p_rid and user_id = auth.uid()
$$;

create or replace function public.rename_restaurant(p_rid uuid, p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role(p_rid) <> 'owner' then raise exception 'Solo il titolare può rinominare il locale'; end if;
  update public.restaurants set name = trim(p_name) where id = p_rid and trim(p_name) <> '';
end $$;

-- ---------- Sicurezza (Row Level Security) ----------

alter table public.restaurants  enable row level security;
alter table public.members      enable row level security;
alter table public.invites      enable row level security;
alter table public.items        enable row level security;
alter table public.activity     enable row level security;
alter table public.public_menus enable row level security;

drop policy if exists r_sel on public.restaurants;
create policy r_sel on public.restaurants for select to authenticated using (public.my_role(id) is not null);

drop policy if exists m_sel on public.members;
create policy m_sel on public.members for select to authenticated using (public.my_role(restaurant_id) is not null);
drop policy if exists m_upd on public.members;
create policy m_upd on public.members for update to authenticated
  using (public.my_role(restaurant_id) = 'owner' and user_id <> auth.uid())
  with check (public.my_role(restaurant_id) = 'owner' and role in ('manager','cook'));
drop policy if exists m_del on public.members;
create policy m_del on public.members for delete to authenticated
  using ((public.my_role(restaurant_id) = 'owner' and user_id <> auth.uid()) or (user_id = auth.uid() and role <> 'owner'));

drop policy if exists i_sel on public.invites;
create policy i_sel on public.invites for select to authenticated using (public.my_role(restaurant_id) in ('owner','manager'));
drop policy if exists i_del on public.invites;
create policy i_del on public.invites for delete to authenticated using (public.my_role(restaurant_id) in ('owner','manager'));

-- i cuochi non vedono prezzi e food cost (coll = 'cost') né gli attestati del personale (coll = 'att')
drop policy if exists it_sel on public.items;
create policy it_sel on public.items for select to authenticated
  using (public.my_role(restaurant_id) in ('owner','manager') or (public.my_role(restaurant_id) = 'cook' and coll not in ('cost','att')));
drop policy if exists it_ins on public.items;
create policy it_ins on public.items for insert to authenticated
  with check (public.can_write_item(restaurant_id, coll, false));
drop policy if exists it_upd on public.items;
create policy it_upd on public.items for update to authenticated
  using (public.can_write_item(restaurant_id, coll, true))
  with check (public.can_write_item(restaurant_id, coll, true));

drop policy if exists a_sel on public.activity;
create policy a_sel on public.activity for select to authenticated using (public.my_role(restaurant_id) is not null);
drop policy if exists a_ins on public.activity;
create policy a_ins on public.activity for insert to authenticated
  with check (public.my_role(restaurant_id) is not null and user_id = auth.uid());

drop policy if exists pm_sel on public.public_menus;
create policy pm_sel on public.public_menus for select to anon, authenticated
  using (published or public.my_role(restaurant_id) in ('owner','manager'));
drop policy if exists pm_ins on public.public_menus;
create policy pm_ins on public.public_menus for insert to authenticated
  with check (public.my_role(restaurant_id) in ('owner','manager'));
drop policy if exists pm_upd on public.public_menus;
create policy pm_upd on public.public_menus for update to authenticated
  using (public.my_role(restaurant_id) in ('owner','manager'))
  with check (public.my_role(restaurant_id) in ('owner','manager'));

-- ---------- Permessi di accesso ----------

grant usage on schema public to anon, authenticated;
grant select on public.public_menus to anon;
grant select on public.restaurants to authenticated;
grant select, update, delete on public.members to authenticated;
grant select, delete on public.invites to authenticated;
grant select, insert, update on public.items to authenticated;
grant select, insert on public.activity to authenticated;
grant select, insert, update on public.public_menus to authenticated;

revoke execute on function public.create_restaurant(text, text) from public, anon;
revoke execute on function public.create_invite(uuid, text)     from public, anon;
revoke execute on function public.join_restaurant(text, text)   from public, anon;
revoke execute on function public.my_restaurants()              from public, anon;
revoke execute on function public.set_my_name(uuid, text)       from public, anon;
revoke execute on function public.rename_restaurant(uuid, text) from public, anon;
grant execute on function public.create_restaurant(text, text) to authenticated;
grant execute on function public.create_invite(uuid, text)     to authenticated;
grant execute on function public.join_restaurant(text, text)   to authenticated;
grant execute on function public.my_restaurants()              to authenticated;
grant execute on function public.set_my_name(uuid, text)       to authenticated;
grant execute on function public.rename_restaurant(uuid, text) to authenticated;
