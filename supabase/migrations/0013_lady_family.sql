-- Lady Family (aba Eventos do app).
-- Quem indicou 5 amigas (as mesmas indicações do "Indique amigas", migração 0011) e fez 15 serviços
-- no salão (atendimentos marcados como "Atendida" no painel) entra para a família da Leide e ganha
-- 10% de desconto permanente em todos os serviços.
-- Para continuar na família: 1 serviço por mês e 1 amiga nova indicada a cada 3 meses.
-- O prazo conta a partir da entrada ou do último serviço/indicação. Passou do prazo, sai da família.
-- Quem saiu volta ao fazer 1 serviço e indicar 1 amiga nova depois da saída.
-- Outros cupons (Lady Points, Indique amigas) valem sobre o preço que já tem os 10% da família.
-- Não precisa de agendador: a situação é conferida sempre que o app ou o painel olham.
-- Rode este arquivo inteiro no SQL Editor do Supabase (depois do 0012). Pode rodar de novo sem problema.

create table if not exists public.lady_family (
  phone text primary key,
  entrou_em timestamptz not null,   -- entrada atual (ou a volta, depois de sair)
  saiu_em timestamptz,              -- preenchido quando perdeu um prazo; nulo = é da família
  primeira_vez timestamptz not null default now(),
  vezes integer not null default 1
);

alter table public.lady_family enable row level security;
grant select, insert, update, delete on public.lady_family to authenticated;
drop policy if exists "admin gerencia lady family" on public.lady_family;
create policy "admin gerencia lady family" on public.lady_family
  for all to authenticated using (is_admin()) with check (is_admin());

-- Serviços feitos pela cliente (atendimentos concluídos que já aconteceram)
create or replace function public.family_servicos(p_phone text, p_desde timestamptz default '-infinity')
returns setof timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select a.starts_at from appointments a
  where lady_fone(a.client_phone) = p_phone and a.status = 'concluido'
    and a.starts_at > p_desde and a.starts_at <= now();
$$;

-- Indicações que valem (a amiga agendou e não cancelou), pela data da indicação
create or replace function public.family_indicacoes(p_phone text, p_desde timestamptz default '-infinity')
returns setof timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select i.created_at from convite_indicacoes i
  join appointments a on a.id = i.reserva_id
  where i.madrinha_phone = p_phone and a.status <> 'cancelado' and i.created_at > p_desde;
$$;

-- Primeiro prazo perdido desde a entrada (nulo = está tudo em dia).
-- Olha os intervalos entre a entrada, cada serviço/indicação e hoje.
create or replace function public.family_saida(p_phone text, p_desde timestamptz)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  with s as (
    select t, lag(t) over (order by t) as ant
    from (select p_desde as t union all select family_servicos(p_phone, p_desde) union all select now()) x
  ),
  i as (
    select t, lag(t) over (order by t) as ant
    from (select p_desde as t union all select family_indicacoes(p_phone, p_desde) union all select now()) x
  )
  select least(
    (select min(ant + interval '1 month') from s where t > ant + interval '1 month'),
    (select min(ant + interval '3 months') from i where t > ant + interval '3 months')
  );
$$;

-- Confere e atualiza a situação da cliente na família. Devolve a linha (ou nada, se nunca entrou).
create or replace function public.family_conferir(p_phone text)
returns public.lady_family
language plpgsql
security definer
set search_path = public
as $$
declare
  f lady_family;
  v_saida timestamptz;
  v_s timestamptz;
  v_i timestamptz;
begin
  select * into f from lady_family where phone = p_phone;
  if f.phone is null then
    if (select count(*) from family_servicos(p_phone)) >= 15 and convite_validas(p_phone) >= 5 then
      insert into lady_family (phone, entrou_em) values (p_phone, now())
      on conflict (phone) do nothing;
      select * into f from lady_family where phone = p_phone;
    end if;
    return f;
  end if;

  loop
    if f.saiu_em is null then
      v_saida := family_saida(p_phone, f.entrou_em);
      exit when v_saida is null;
      update lady_family set saiu_em = v_saida where phone = p_phone returning * into f;
    else
      -- Volta para a família: 1 serviço e 1 indicação depois da saída
      select min(t) into v_s from family_servicos(p_phone, f.saiu_em) t;
      select min(t) into v_i from family_indicacoes(p_phone, f.saiu_em) t;
      exit when v_s is null or v_i is null;
      update lady_family set entrou_em = greatest(v_s, v_i), saiu_em = null, vezes = vezes + 1
      where phone = p_phone returning * into f;
    end if;
  end loop;
  return f;
end;
$$;

-- Tudo o que a tela mostra sobre uma cliente
create or replace function public.family_resumo(p_phone text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  f lady_family := family_conferir(p_phone);
  v_membro boolean := f.phone is not null and f.saiu_em is null;
begin
  return json_build_object(
    'servicos', (select count(*) from family_servicos(p_phone)),
    'amigas', convite_validas(p_phone),
    'membro', v_membro,
    'desde', case when v_membro then f.entrou_em end,
    'primeira_vez', f.primeira_vez,
    'saiu_em', f.saiu_em,
    'servico_ate', case when v_membro then
      greatest(f.entrou_em, (select max(t) from family_servicos(p_phone, f.entrou_em) t)) + interval '1 month' end,
    'indicacao_ate', case when v_membro then
      greatest(f.entrou_em, (select max(t) from family_indicacoes(p_phone, f.entrou_em) t)) + interval '3 months' end,
    -- Quem saiu: já fez o serviço / a indicação da volta?
    'volta_servico', case when f.saiu_em is not null then exists (select 1 from family_servicos(p_phone, f.saiu_em)) end,
    'volta_indicacao', case when f.saiu_em is not null then exists (select 1 from family_indicacoes(p_phone, f.saiu_em)) end
  );
end;
$$;

-- App: a situação da cliente deste celular
create or replace function public.family_minha(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
begin
  select phone into v_phone from lady_aparelhos where token = p_token;
  if v_phone is null then
    return json_build_object('participando', false);
  end if;
  return (family_resumo(v_phone)::jsonb || jsonb_build_object('participando', true, 'nome', convite_nome(v_phone)))::json;
end;
$$;

-- Painel: quem é da família, quem está quase e quem saiu
create or replace function public.family_painel()
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'sem_permissao';
  end if;
  return coalesce((
    select json_agg((family_resumo(c.phone)::jsonb || jsonb_build_object('phone', c.phone, 'nome', convite_nome(c.phone)))::json)
    from (
      -- Só quem já está perto (10 serviços ou 3 amigas) ou já entrou um dia
      select phone from lady_family
      union
      select lady_fone(client_phone) from appointments where status = 'concluido'
      group by 1 having count(*) >= 10
      union
      select madrinha_phone from convite_indicacoes group by 1 having count(*) >= 3
    ) c
  ), '[]'::json);
end;
$$;

revoke all on function public.family_servicos(text, timestamptz) from public, anon, authenticated;
revoke all on function public.family_indicacoes(text, timestamptz) from public, anon, authenticated;
revoke all on function public.family_saida(text, timestamptz) from public, anon, authenticated;
revoke all on function public.family_conferir(text) from public, anon, authenticated;
revoke all on function public.family_resumo(text) from public, anon, authenticated;
revoke all on function public.family_minha(uuid) from public;
revoke all on function public.family_painel() from public;
grant execute on function public.family_minha(uuid) to anon, authenticated;
grant execute on function public.family_painel() to authenticated;
