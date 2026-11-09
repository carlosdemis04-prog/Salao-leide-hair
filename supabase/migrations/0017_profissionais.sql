-- Duas agendas: Leide (cabelos em geral) e Vanessa (unhas, depilação e estética).
-- Rode este arquivo inteiro no SQL Editor do Supabase (depois do 0016). Pode rodar de novo sem problema.
--
-- O que muda:
--   1. Cada serviço pertence a uma profissional. Unha, depilação, sobrancelha e estética vão para a Vanessa;
--      o resto continua com a Leide. Dá para trocar depois no painel (Mais > Serviços e preços).
--   2. Cada agendamento guarda a profissional do serviço (sozinho, sem ninguém precisar escolher).
--   3. As duas podem atender no mesmo horário: um horário só fica ocupado para quem está atendendo.
--   4. Folga e horário fechado podem ser do salão todo, só da Leide ou só da Vanessa.
--      Compromissos do Google Agenda da Leide fecham só a agenda da Leide.

create extension if not exists btree_gist with schema extensions;

-- 1. Profissionais ------------------------------------------------------------------------------
create table if not exists public.professionals (
  id text primary key,
  name text not null,
  area text,
  sort_order integer not null default 0
);

insert into public.professionals (id, name, area, sort_order) values
  ('leide', 'Leide', 'Cabelos', 1),
  ('vanessa', 'Vanessa', 'Unhas, depilação e estética', 2)
on conflict (id) do nothing;

alter table public.professionals enable row level security;
drop policy if exists "profissionais sao publicas" on public.professionals;
create policy "profissionais sao publicas" on public.professionals for select using (true);
grant select on public.professionals to anon, authenticated;

-- 2. Serviços -----------------------------------------------------------------------------------
alter table public.services
  add column if not exists profissional text not null default 'leide' references public.professionals (id);

-- Só na primeira vez (quando ainda está tudo com a Leide): separa os serviços da Vanessa pelo nome
update public.services set profissional = 'vanessa'
where profissional = 'leide'
  and not exists (select 1 from public.services where profissional = 'vanessa')
  and (name ilike '%manicure%' or name ilike '%pedicure%' or name ilike '%unha%'
       or name ilike '%depila%' or name ilike '%sobrancelha%' or name ilike '%est_tica%');

-- 3. Agendamentos -------------------------------------------------------------------------------
alter table public.appointments
  add column if not exists profissional text not null default 'leide' references public.professionals (id);

update public.appointments a set profissional = s.profissional
from public.services s
where s.id = a.service_id and a.profissional is distinct from s.profissional;

-- O agendamento sempre fica com a profissional do serviço
create or replace function public.appointments_profissional()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select profissional into new.profissional from services where id = new.service_id;
  new.profissional := coalesce(new.profissional, 'leide');
  return new;
end;
$$;

drop trigger if exists appointments_profissional on public.appointments;
create trigger appointments_profissional
  before insert or update of service_id on public.appointments
  for each row execute function public.appointments_profissional();

-- Antes: dois agendamentos nunca no mesmo horário. Agora: nunca no mesmo horário para a mesma profissional.
alter table public.appointments drop constraint if exists appointments_sem_sobreposicao;
alter table public.appointments add constraint appointments_sem_sobreposicao exclude using gist (
  profissional with =,
  tstzrange(starts_at, ends_at) with &&
) where (status <> 'cancelado');

-- 4. Bloqueios (folgas e horários fechados) ----------------------------------------------------
-- null = salão todo. Bloqueio novo sem dizer de quem fica com a Leide (é o caso do Google Agenda dela).
alter table public.blocked_times
  add column if not exists profissional text references public.professionals (id);

do $$
begin
  -- Só na primeira vez: folgas antigas valiam para o salão todo; Google e "Marcado por fora" eram da Leide
  if (select column_default from information_schema.columns
      where table_schema = 'public' and table_name = 'blocked_times' and column_name = 'profissional') is null then
    update public.blocked_times set profissional = 'leide'
    where google_event_id is not null or reason = 'Marcado por fora';
    alter table public.blocked_times alter column profissional set default 'leide';
  end if;
end;
$$;

-- 5. Horários livres: só olha a agenda de quem faz o serviço -----------------------------------
create or replace function public.get_available_slots(p_service_id uuid, p_date date)
returns table (slot_start timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with svc as (
    select make_interval(mins => duration_min) as dur, profissional
    from services
    where id = p_service_id and active
  ),
  candidates as (
    select
      (t at time zone 'America/Sao_Paulo') as s,
      ((t + svc.dur) at time zone 'America/Sao_Paulo') as e,
      svc.profissional as prof
    from svc
    join business_hours h on h.weekday = extract(dow from p_date)::int
    cross join lateral generate_series(
      p_date + h.open_time,
      p_date + h.close_time - svc.dur,
      interval '30 minutes'
    ) as t
  )
  select distinct c.s
  from candidates c
  where c.s > now() + interval '1 hour'
    and not exists (
      select 1 from appointments a
      where a.status <> 'cancelado'
        and a.profissional = c.prof
        and tstzrange(a.starts_at, a.ends_at) && tstzrange(c.s, c.e)
    )
    and not exists (
      select 1 from blocked_times b
      where (b.profissional is null or b.profissional = c.prof)
        and tstzrange(b.starts_at, b.ends_at) && tstzrange(c.s, c.e)
    )
  order by c.s;
$$;

-- 6. Google Agenda: agendamento da Vanessa aparece com o nome dela na frente -------------------
create or replace function public.google_pendentes(p_token text)
returns table (
  id uuid,
  versao integer,
  status text,
  starts_at timestamptz,
  ends_at timestamptz,
  client_name text,
  client_phone text,
  servico text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform google_confere(p_token);
  return query
    select a.id, a.google_versao, a.status, a.starts_at, a.ends_at, a.client_name, a.client_phone,
           case when a.profissional = 'leide' then s.name else p.name || ': ' || s.name end
    from appointments a
    join services s on s.id = a.service_id
    join professionals p on p.id = a.profissional
    where a.google_enviado < a.google_versao
      and a.starts_at > now() - interval '1 day'
    order by a.starts_at
    limit 50;
end;
$$;

-- Permissões (desde a 0015 funções novas nascem fechadas)
revoke all on function public.appointments_profissional() from public, anon, authenticated;
grant execute on function public.get_available_slots(uuid, date) to anon, authenticated;
revoke all on function public.google_pendentes(text) from public, authenticated;
grant execute on function public.google_pendentes(text) to anon;
