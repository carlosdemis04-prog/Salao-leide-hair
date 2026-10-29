-- Segurança: fecha os buracos achados na revisão de 2026-10-29.
-- Rode este arquivo inteiro no SQL Editor do Supabase (depois do 0014). Pode rodar de novo sem problema.
--
-- 1. Pontos e cupons de outra pessoa: antes, bastava agendar com o WhatsApp de outra cliente para o
--    celular passar a mostrar (e resgatar) os pontos e cupons dela. Agora o celular só entra na corrida
--    com uma reserva que a Leide já confirmou ("marcado") ou atendeu. Ela confirma pelo WhatsApp,
--    então quem não é dona do número não passa.
-- 2. Amigas inventadas: antes, cada reserva com um telefone inventado contava como amiga indicada
--    (3 reservas falsas = cupom de 30%). Agora a indicação só conta quando a amiga vem ao salão
--    (a Leide marca "Atendida").
-- 3. Agenda lotada de mentira: cada WhatsApp pode ter no máximo 3 horários marcados ao mesmo tempo,
--    e o site aceita no máximo 15 agendamentos novos por hora.
-- 4. Funções do painel deixam de aceitar visitantes sem login, e funções novas deixam de nascer abertas.

-- 3. Limites no agendamento ----------------------------------------------------------------------
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

  -- Ninguém precisa de mais de 3 horários marcados ao mesmo tempo
  if (select count(*) from appointments
      where lady_fone(client_phone) = lady_fone(v_phone)
        and status in ('pendente', 'confirmado') and starts_at > now()) >= 3 then
    raise exception 'limite_por_telefone';
  end if;
  -- Um salão de uma pessoa não recebe 15 agendamentos numa hora: isso é robô
  if (select count(*) from appointments where created_at > now() - interval '1 hour') >= 15 then
    raise exception 'muitos_agendamentos';
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

-- 1. Celular só entra na corrida com reserva confirmada ---------------------------------------------
create or replace function public.lady_vincular(p_token uuid, p_reserva uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_status text;
begin
  select lady_fone(client_phone), status into v_phone, v_status from appointments where id = p_reserva;
  if v_phone is null or length(v_phone) < 10 then
    raise exception 'reserva_nao_encontrada';
  end if;
  -- O app chama de novo toda vez que abre, então entra sozinho assim que a Leide confirmar
  if v_status not in ('confirmado', 'concluido') then
    raise exception 'aguardando_confirmacao';
  end if;
  insert into lady_aparelhos (token, phone) values (p_token, v_phone)
  on conflict (token) do update set phone = excluded.phone;
end;
$$;

-- Desfaz as ligações antigas que não têm nenhuma reserva confirmada ou atendida por trás.
-- Quem é cliente de verdade volta sozinho quando a Leide confirmar o próximo horário.
delete from public.lady_aparelhos l
where not exists (
  select 1 from public.appointments a
  where lady_fone(a.client_phone) = l.phone and a.status in ('confirmado', 'concluido')
);
update public.contas_clientes c set phone = null, updated_at = now()
where c.phone is not null and not exists (
  select 1 from public.appointments a
  where lady_fone(a.client_phone) = c.phone and a.status in ('confirmado', 'concluido')
);

-- 2. Indicação só conta quando a amiga vem ao salão -------------------------------------------------
create or replace function public.convite_validas(p_phone text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from convite_indicacoes i
  join appointments a on a.id = i.reserva_id
  where i.madrinha_phone = p_phone and a.status = 'concluido';
$$;

create or replace function public.family_indicacoes(p_phone text, p_desde timestamptz default '-infinity')
returns setof timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select i.created_at from convite_indicacoes i
  join appointments a on a.id = i.reserva_id
  where i.madrinha_phone = p_phone and a.status = 'concluido' and i.created_at > p_desde;
$$;

-- 4. Permissões das funções ---------------------------------------------------------------------
-- O Supabase dá acesso a toda função nova para visitantes (anon). "revoke ... from public" não tira esse
-- acesso; por isso as funções do painel e as internas estavam abertas (elas conferiam is_admin, mas
-- não precisam nem ser chamáveis por quem não entrou).
revoke all on function public.lady_lancar(text, integer, text) from public, anon;
revoke all on function public.lady_pendentes() from public, anon;
revoke all on function public.lady_validar(text) from public, anon;
revoke all on function public.convite_painel() from public, anon;
revoke all on function public.family_painel() from public, anon;
revoke all on function public.conta_ligar(uuid) from public, anon;
revoke all on function public.google_confere(text) from public, anon, authenticated;
revoke all on function public.ics_escape(text) from public, anon, authenticated;
revoke all on function public.lady_fone(text) from public, anon, authenticated;
revoke all on function public.registrar_cliente() from public, anon, authenticated;
revoke all on function public.appointments_nova_versao() from public, anon, authenticated;
revoke all on function public.convite_validas(text) from public, anon, authenticated;
revoke all on function public.family_indicacoes(text, timestamptz) from public, anon, authenticated;
-- O worker do Google entra sem login (com o google_token), só nestas três
revoke all on function public.google_pendentes(text) from public, authenticated;
revoke all on function public.google_enviado(text, uuid, integer) from public, authenticated;
revoke all on function public.google_bloqueios(text, timestamptz, timestamptz, jsonb) from public, authenticated;

grant execute on function public.book_appointment(uuid, timestamptz, text, text) to anon, authenticated;
grant execute on function public.lady_vincular(uuid, uuid) to anon, authenticated;
grant execute on function public.lady_lancar(text, integer, text) to authenticated;
grant execute on function public.lady_pendentes() to authenticated;
grant execute on function public.lady_validar(text) to authenticated;
grant execute on function public.convite_painel() to authenticated;
grant execute on function public.family_painel() to authenticated;
grant execute on function public.conta_ligar(uuid) to authenticated;
grant execute on function public.google_pendentes(text) to anon;
grant execute on function public.google_enviado(text, uuid, integer) to anon;
grant execute on function public.google_bloqueios(text, timestamptz, timestamptz, jsonb) to anon;

-- Daqui para frente, função nova nasce fechada: cada migração diz quem pode chamar (todas já dizem)
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
