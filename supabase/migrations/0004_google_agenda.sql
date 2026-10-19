-- Ligação direta com o Google Agenda da Leide.
-- Rode este arquivo inteiro no SQL Editor do Supabase (depois do 0003).
--
-- Quem faz a troca é o worker da Cloudflare, a cada 5 minutos:
--   1. manda para o Google os agendamentos novos ou alterados;
--   2. lê os compromissos que a Leide marcou no Google e bloqueia esses horários no site.
-- O worker entra com uma senha própria (google_token), que só serve para estas funções.

alter table public.settings
  add column if not exists google_token text not null
  default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

-- Cada mudança num agendamento aumenta a versão; o worker anota qual versão já mandou.
alter table public.appointments
  add column if not exists google_versao integer not null default 1,
  add column if not exists google_enviado integer not null default 0;

-- Bloqueios que vieram do Google guardam o id do compromisso de lá
alter table public.blocked_times
  add column if not exists google_event_id text unique;

create or replace function public.appointments_nova_versao()
returns trigger
language plpgsql
as $$
begin
  if (new.status, new.starts_at, new.ends_at, new.client_name, new.client_phone, new.service_id)
     is distinct from
     (old.status, old.starts_at, old.ends_at, old.client_name, old.client_phone, old.service_id) then
    new.google_versao := old.google_versao + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_nova_versao on public.appointments;
create trigger appointments_nova_versao
  before update on public.appointments
  for each row execute function public.appointments_nova_versao();

create or replace function public.google_confere(p_token text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_token is null or not exists (select 1 from settings where google_token = p_token) then
    raise exception 'token_invalido';
  end if;
end;
$$;

-- Agendamentos que o Google ainda não recebeu (só de ontem em diante)
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
    select a.id, a.google_versao, a.status, a.starts_at, a.ends_at, a.client_name, a.client_phone, s.name
    from appointments a
    join services s on s.id = a.service_id
    where a.google_enviado < a.google_versao
      and a.starts_at > now() - interval '1 day'
    order by a.starts_at
    limit 50;
end;
$$;

create or replace function public.google_enviado(p_token text, p_id uuid, p_versao integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform google_confere(p_token);
  update appointments set google_enviado = p_versao
  where id = p_id and google_enviado < p_versao;
end;
$$;

-- Troca os bloqueios vindos do Google no período pelos compromissos atuais de lá.
-- p_eventos: [{"id": "...", "inicio": "2026-10-20T13:00:00Z", "fim": "..."}]
create or replace function public.google_bloqueios(
  p_token text,
  p_inicio timestamptz,
  p_fim timestamptz,
  p_eventos jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  perform google_confere(p_token);

  delete from blocked_times b
  where b.google_event_id is not null
    and b.ends_at > p_inicio
    and b.starts_at < p_fim
    and b.google_event_id not in (select e->>'id' from jsonb_array_elements(p_eventos) e);

  insert into blocked_times (starts_at, ends_at, reason, google_event_id)
  select (e->>'inicio')::timestamptz, (e->>'fim')::timestamptz, 'Compromisso no Google Agenda', e->>'id'
  from jsonb_array_elements(p_eventos) e
  where (e->>'fim')::timestamptz > (e->>'inicio')::timestamptz
  on conflict (google_event_id) do update
    set starts_at = excluded.starts_at, ends_at = excluded.ends_at;

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

revoke all on function public.google_confere(text) from public;
revoke all on function public.google_pendentes(text) from public;
revoke all on function public.google_enviado(text, uuid, integer) from public;
revoke all on function public.google_bloqueios(text, timestamptz, timestamptz, jsonb) from public;
grant execute on function public.google_pendentes(text) to anon;
grant execute on function public.google_enviado(text, uuid, integer) to anon;
grant execute on function public.google_bloqueios(text, timestamptz, timestamptz, jsonb) to anon;
