-- App para celular (/app): ofertas, eventos e "meu agendamento".
-- Rode este arquivo inteiro no SQL Editor do Supabase (depois do 0004).
-- Pode rodar de novo sem problema.

-- Ofertas do salão. Só aparecem no app as que estão ativas e dentro da validade.
-- Preço em centavos (R$ 60,00 = 6000). Deixe em branco o que não existir.
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  conditions text,
  image_url text,
  price_cents integer check (price_cents >= 0),
  original_price_cents integer check (original_price_cents >= 0),
  service_id uuid references public.services(id) on delete set null,
  valid_until date,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Eventos do salão (workshop, dia especial, lançamento...). Inscrição pelo WhatsApp.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  spots integer check (spots >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

alter table public.offers enable row level security;
alter table public.events enable row level security;

grant select on public.offers, public.events to anon, authenticated;
grant insert, update, delete on public.offers, public.events to authenticated;

drop policy if exists "ofertas ativas sao publicas" on public.offers;
create policy "ofertas ativas sao publicas" on public.offers
  for select to anon, authenticated
  using (active and (valid_until is null or valid_until >= (now() at time zone 'America/Sao_Paulo')::date));

drop policy if exists "admin gerencia ofertas" on public.offers;
create policy "admin gerencia ofertas" on public.offers
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "eventos ativos sao publicos" on public.events;
create policy "eventos ativos sao publicos" on public.events
  for select to anon, authenticated
  using (active and coalesce(ends_at, starts_at) >= now());

drop policy if exists "admin gerencia eventos" on public.events;
create policy "admin gerencia eventos" on public.events
  for all to authenticated using (is_admin()) with check (is_admin());

-- "Meu agendamento": o app guarda no celular o código da reserva que acabou de fazer
-- e consulta a situação com ele. O código é longo e aleatório, então só quem
-- agendou consegue ver. Não devolve nome nem telefone.
create or replace function public.consultar_reserva(p_id uuid)
returns table (status text, starts_at timestamptz, ends_at timestamptz, service_name text)
language sql
stable
security definer
set search_path = public
as $$
  select a.status, a.starts_at, a.ends_at, s.name
  from appointments a
  join services s on s.id = a.service_id
  where a.id = p_id;
$$;

-- A cliente pode cancelar pelo app até 2 horas antes. Depois disso, só pelo WhatsApp.
create or replace function public.cancelar_reserva(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inicio timestamptz;
  v_status text;
begin
  select starts_at, status into v_inicio, v_status from appointments where id = p_id;
  if v_inicio is null then
    raise exception 'reserva_nao_encontrada';
  end if;
  if v_status in ('cancelado', 'concluido') then
    raise exception 'reserva_encerrada';
  end if;
  if v_inicio < now() + interval '2 hours' then
    raise exception 'cancelamento_tarde';
  end if;
  update appointments set status = 'cancelado' where id = p_id;
end;
$$;

revoke all on function public.consultar_reserva(uuid) from public;
revoke all on function public.cancelar_reserva(uuid) from public;
grant execute on function public.consultar_reserva(uuid) to anon, authenticated;
grant execute on function public.cancelar_reserva(uuid) to anon, authenticated;
