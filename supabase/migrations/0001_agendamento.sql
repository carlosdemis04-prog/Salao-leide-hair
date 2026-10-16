-- Agendamento do Salão Leide Hair
-- Rode este arquivo inteiro no SQL Editor do Supabase.

create extension if not exists btree_gist;

-- Serviços oferecidos (preço em centavos para evitar erro de arredondamento)
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  duration_min integer not null check (duration_min > 0),
  active boolean not null default true,
  sort_order integer not null default 0
);

-- Horário de atendimento por dia da semana (0 = domingo ... 6 = sábado).
-- Pode ter mais de uma linha no mesmo dia (ex.: manhã e tarde, com almoço no meio).
create table if not exists public.business_hours (
  id serial primary key,
  weekday smallint not null check (weekday between 0 and 6),
  open_time time not null,
  close_time time not null,
  check (close_time > open_time)
);

-- Períodos em que ela não atende (folga, compromisso, feriado)
create table if not exists public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  check (ends_at > starts_at)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id),
  client_name text not null,
  client_phone text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'confirmado', 'cancelado', 'concluido')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- Impede dois agendamentos no mesmo horário, mesmo se duas clientes clicarem juntas
  constraint appointments_sem_sobreposicao exclude using gist (
    tstzrange(starts_at, ends_at) with &&
  ) where (status <> 'cancelado')
);

-- Segurança: o site público só lê serviços ativos e horários de atendimento.
-- Agendamentos e bloqueios ficam fechados; o site só acessa pelas funções abaixo.
alter table public.services enable row level security;
alter table public.business_hours enable row level security;
alter table public.blocked_times enable row level security;
alter table public.appointments enable row level security;

grant select on public.services, public.business_hours to anon, authenticated;

drop policy if exists "servicos ativos sao publicos" on public.services;
create policy "servicos ativos sao publicos" on public.services
  for select to anon, authenticated using (active);

drop policy if exists "horarios sao publicos" on public.business_hours;
create policy "horarios sao publicos" on public.business_hours
  for select to anon, authenticated using (true);

-- Horários livres de um serviço em um dia, a cada 30 minutos, no fuso de São Paulo.
create or replace function public.get_available_slots(p_service_id uuid, p_date date)
returns table (slot_start timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with svc as (
    select make_interval(mins => duration_min) as dur
    from services
    where id = p_service_id and active
  ),
  candidates as (
    select
      (t at time zone 'America/Sao_Paulo') as s,
      ((t + svc.dur) at time zone 'America/Sao_Paulo') as e
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
        and tstzrange(a.starts_at, a.ends_at) && tstzrange(c.s, c.e)
    )
    and not exists (
      select 1 from blocked_times b
      where tstzrange(b.starts_at, b.ends_at) && tstzrange(c.s, c.e)
    )
  order by c.s;
$$;

-- Cria o agendamento se o horário ainda estiver livre. Retorna o id.
create or replace function public.book_appointment(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_client_name text,
  p_client_phone text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dur integer;
  v_id uuid;
  v_phone text := regexp_replace(coalesce(p_client_phone, ''), '\D', '', 'g');
begin
  if length(trim(coalesce(p_client_name, ''))) < 2 or length(p_client_name) > 100 then
    raise exception 'nome_invalido';
  end if;
  if length(v_phone) not between 10 and 13 then
    raise exception 'telefone_invalido';
  end if;

  select duration_min into v_dur from services where id = p_service_id and active;
  if v_dur is null then
    raise exception 'servico_invalido';
  end if;

  if not exists (
    select 1
    from get_available_slots(p_service_id, (p_starts_at at time zone 'America/Sao_Paulo')::date)
    where slot_start = p_starts_at
  ) then
    raise exception 'horario_indisponivel';
  end if;

  begin
    insert into appointments (service_id, client_name, client_phone, starts_at, ends_at)
    values (p_service_id, trim(p_client_name), v_phone, p_starts_at,
            p_starts_at + make_interval(mins => v_dur))
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'horario_indisponivel';
  end;

  return v_id;
end;
$$;

revoke all on function public.get_available_slots(uuid, date) from public;
revoke all on function public.book_appointment(uuid, timestamptz, text, text) from public;
grant execute on function public.get_available_slots(uuid, date) to anon, authenticated;
grant execute on function public.book_appointment(uuid, timestamptz, text, text) to anon, authenticated;
