-- Painel da Leide: acesso de administradora e link da agenda para o Google Agenda.
-- Rode este arquivo inteiro no SQL Editor do Supabase (depois do 0001 e do 0002).

-- Quem pode entrar no painel. Só quem estiver nesta tabela vê e mexe nos agendamentos;
-- criar uma conta qualquer no Supabase não dá acesso a nada.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "admin ve a propria linha" on public.admins;
create policy "admin ve a propria linha" on public.admins
  for select to authenticated using (user_id = auth.uid());

grant select on public.admins to authenticated;
grant select, insert, update, delete on public.services, public.business_hours,
  public.blocked_times, public.appointments to authenticated;
grant usage, select on sequence public.business_hours_id_seq to authenticated;

drop policy if exists "admin gerencia servicos" on public.services;
create policy "admin gerencia servicos" on public.services
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admin gerencia horarios" on public.business_hours;
create policy "admin gerencia horarios" on public.business_hours
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admin gerencia bloqueios" on public.blocked_times;
create policy "admin gerencia bloqueios" on public.blocked_times
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admin gerencia agendamentos" on public.appointments;
create policy "admin gerencia agendamentos" on public.appointments
  for all to authenticated using (is_admin()) with check (is_admin());

-- Link secreto da agenda (.ics). Quem tiver o link vê os agendamentos, então ele
-- fica guardado aqui e só a administradora consegue ler.
create table if not exists public.settings (
  id boolean primary key default true check (id),
  calendar_token text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);

insert into public.settings (id) values (true) on conflict (id) do nothing;

alter table public.settings enable row level security;
grant select, update on public.settings to authenticated;

drop policy if exists "admin le configuracoes" on public.settings;
create policy "admin le configuracoes" on public.settings
  for all to authenticated using (is_admin()) with check (is_admin());

-- Texto para o iCalendar: escapa vírgula, ponto e vírgula, barra e quebra de linha.
create or replace function public.ics_escape(p text)
returns text
language sql
immutable
as $$
  select replace(replace(replace(replace(coalesce(p, ''), '\', '\\'), ';', '\;'), ',', '\,'), E'\n', '\n');
$$;

-- A agenda inteira em formato iCalendar, para assinar no Google Agenda.
create or replace function public.calendar_feed(p_token text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_body text;
  v_fmt constant text := 'YYYYMMDD"T"HH24MISS"Z"';
begin
  if p_token is null or not exists (select 1 from settings where calendar_token = p_token) then
    raise exception 'token_invalido';
  end if;

  select string_agg(
    concat_ws(E'\r\n',
      'BEGIN:VEVENT',
      'UID:' || a.id || '@leidehair',
      'DTSTAMP:' || to_char(a.created_at at time zone 'UTC', v_fmt),
      'DTSTART:' || to_char(a.starts_at at time zone 'UTC', v_fmt),
      'DTEND:' || to_char(a.ends_at at time zone 'UTC', v_fmt),
      'SUMMARY:' || ics_escape(
        case when a.status = 'pendente' then '(a confirmar) ' else '' end || s.name || ' - ' || a.client_name),
      'DESCRIPTION:' || ics_escape('WhatsApp: ' || a.client_phone || E'\nSituação: ' || a.status),
      'STATUS:' || case when a.status = 'pendente' then 'TENTATIVE' else 'CONFIRMED' end,
      'END:VEVENT'),
    E'\r\n' order by a.starts_at)
  into v_body
  from appointments a
  join services s on s.id = a.service_id
  where a.status <> 'cancelado'
    and a.starts_at > now() - interval '60 days';

  return concat_ws(E'\r\n',
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Leide Hair//Agendamentos//PT',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Leide Hair - Agendamentos',
    'X-WR-TIMEZONE:America/Sao_Paulo',
    nullif(v_body, ''),
    'END:VCALENDAR') || E'\r\n';
end;
$$;

revoke all on function public.calendar_feed(text) from public;
grant execute on function public.calendar_feed(text) to anon, authenticated;
