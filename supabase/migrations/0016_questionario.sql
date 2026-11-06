-- Questionário das Ofertas (5% de desconto) e follow up pelo WhatsApp no painel.
-- * A cliente responde o questionário no app (aba Ofertas) e ganha um cupom de 5%, uma vez por WhatsApp.
-- * As respostas entram na ficha da cliente no painel (aba Clientes): e-mail, aniversário, serviços que
--   interessam e as outras perguntas.
-- * No painel, antes de abrir o WhatsApp para um parabéns ou um follow up, a Leide escolhe o benefício.
--   Se for desconto, o painel cria um cupom de verdade, que ela valida no mesmo "Validar código" de sempre.
-- Rode este arquivo inteiro no SQL Editor do Supabase (depois do 0015). Pode rodar de novo sem problema.

-- Cupons novos: 'questionario' (5% do questionário) e 'presente' (dado pela Leide no follow up)
alter table public.convite_cupons drop constraint if exists convite_cupons_tipo_check;
alter table public.convite_cupons add constraint convite_cupons_tipo_check
  check (tipo in ('boas_vindas', 'madrinha', 'questionario', 'presente'));
alter table public.convite_cupons add column if not exists servico text;

-- E-mail da cliente na ficha
alter table public.clients add column if not exists email text;

-- Respostas do questionário: uma por WhatsApp
create table if not exists public.questionario_respostas (
  phone text primary key check (phone ~ '^\d{10,11}$'),
  nome text not null,
  email text not null,
  aniversario date not null,
  servicos text[] not null default '{}',
  origem text,
  frequencia text,
  cabelo text,
  horario text,
  importa text,
  ocasiao text,
  contato text,
  consentimento_em timestamptz not null,
  cupom text,
  created_at timestamptz not null default now()
);

alter table public.questionario_respostas enable row level security;
grant select, insert, update, delete on public.questionario_respostas to authenticated;
drop policy if exists "admin gerencia questionario" on public.questionario_respostas;
create policy "admin gerencia questionario" on public.questionario_respostas
  for all to authenticated using (is_admin()) with check (is_admin());

-- Histórico de mensagens que a Leide mandou pelo painel (parabéns, follow up, oferta) e o benefício dado
create table if not exists public.crm_contatos (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  motivo text not null check (motivo in ('aniversario', 'follow_up', 'oferta')),
  beneficio text not null check (length(beneficio) between 1 and 200),
  cupom text,
  created_at timestamptz not null default now()
);
create index if not exists crm_contatos_phone on public.crm_contatos (phone);

alter table public.crm_contatos enable row level security;
grant select, insert, update, delete on public.crm_contatos to authenticated;
drop policy if exists "admin gerencia contatos" on public.crm_contatos;
create policy "admin gerencia contatos" on public.crm_contatos
  for all to authenticated using (is_admin()) with check (is_admin());

-- Texto curto e limpo (as escolhas do questionário), ou nulo
create or replace function public.questionario_texto(p text)
returns text
language sql
immutable
as $$
  select nullif(left(trim(coalesce(p, '')), 60), '');
$$;

-- App: a cliente responde o questionário e recebe o cupom de 5%.
-- Devolve { codigo, desconto, expira_em }. Erros: nome_invalido, email_invalido, telefone_invalido,
-- aniversario_invalido, sem_consentimento, ja_respondeu, muitas_respostas.
create or replace function public.questionario_responder(
  p_nome text,
  p_email text,
  p_phone text,
  p_aniversario date,
  p_servicos text[],
  p_respostas jsonb,
  p_consentimento boolean
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tel text := lady_fone(p_phone);
  v_email text := lower(trim(coalesce(p_email, '')));
  v_nome text := trim(coalesce(p_nome, ''));
  v_servicos text[];
  v_codigo text;
  v_expira timestamptz := now() + interval '90 days';
begin
  if length(v_nome) < 2 or length(v_nome) > 100 then
    raise exception 'nome_invalido';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 120 then
    raise exception 'email_invalido';
  end if;
  if length(v_tel) not between 10 and 11 then
    raise exception 'telefone_invalido';
  end if;
  if p_aniversario is null or p_aniversario < date '1920-01-01' or p_aniversario > current_date then
    raise exception 'aniversario_invalido';
  end if;
  if not coalesce(p_consentimento, false) then
    raise exception 'sem_consentimento';
  end if;
  if exists (select 1 from questionario_respostas where phone = v_tel) then
    raise exception 'ja_respondeu';
  end if;
  -- Contra robô: o salão não recebe 20 questionários numa hora
  if (select count(*) from questionario_respostas where created_at > now() - interval '1 hour') >= 20 then
    raise exception 'muitas_respostas';
  end if;

  select coalesce(array_agg(distinct left(trim(s), 60)), '{}') into v_servicos
  from unnest(coalesce(p_servicos, '{}')) s
  where trim(s) <> '';
  v_servicos := v_servicos[1:20];

  v_codigo := convite_novo_codigo();
  insert into convite_cupons (phone, tipo, desconto, codigo, expira_em)
  values (v_tel, 'questionario', 5, v_codigo, v_expira);

  insert into questionario_respostas (
    phone, nome, email, aniversario, servicos, origem, frequencia, cabelo, horario, importa, ocasiao, contato,
    consentimento_em, cupom
  ) values (
    v_tel, v_nome, v_email, p_aniversario, v_servicos,
    questionario_texto(p_respostas->>'origem'),
    questionario_texto(p_respostas->>'frequencia'),
    questionario_texto(p_respostas->>'cabelo'),
    questionario_texto(p_respostas->>'horario'),
    questionario_texto(p_respostas->>'importa'),
    questionario_texto(p_respostas->>'ocasiao'),
    questionario_texto(p_respostas->>'contato'),
    now(), v_codigo
  );

  -- Ficha da cliente no CRM: cria ou completa (não apaga o que a Leide já anotou)
  if exists (select 1 from clients where lady_fone(phone) = v_tel) then
    update clients
       set email = v_email,
           birthday = coalesce(birthday, p_aniversario),
           origin = coalesce(origin, questionario_texto(p_respostas->>'origem'))
     where lady_fone(phone) = v_tel;
  else
    insert into clients (phone, name, email, birthday, origin)
    values (v_tel, v_nome, v_email, p_aniversario, questionario_texto(p_respostas->>'origem'));
  end if;

  return json_build_object('codigo', v_codigo, 'desconto', 5, 'expira_em', v_expira);
exception when unique_violation then
  raise exception 'ja_respondeu';
end;
$$;

-- Painel: registra a mensagem que a Leide vai mandar e, se o benefício for desconto, cria o cupom.
-- p_desconto nulo = sem cupom (mimo, brinde ou só uma mensagem). Devolve { codigo, expira_em }.
create or replace function public.crm_follow_up(
  p_phone text,
  p_motivo text,
  p_beneficio text,
  p_desconto integer,
  p_dias integer,
  p_servico text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tel text := lady_fone(p_phone);
  v_codigo text;
  v_expira timestamptz;
begin
  if not is_admin() then
    raise exception 'sem_permissao';
  end if;
  if length(v_tel) < 10 then
    raise exception 'telefone_invalido';
  end if;
  if p_desconto is not null then
    if p_desconto not between 1 and 100 or coalesce(p_dias, 0) not between 1 and 365 then
      raise exception 'desconto_invalido';
    end if;
    v_codigo := convite_novo_codigo();
    v_expira := now() + make_interval(days => p_dias);
    insert into convite_cupons (phone, tipo, desconto, codigo, expira_em, servico)
    values (v_tel, 'presente', p_desconto, v_codigo, v_expira, nullif(left(trim(coalesce(p_servico, '')), 80), ''));
  end if;
  insert into crm_contatos (phone, motivo, beneficio, cupom)
  values (v_tel, p_motivo, left(trim(p_beneficio), 200), v_codigo);
  return json_build_object('codigo', v_codigo, 'expira_em', v_expira);
end;
$$;

-- O "Validar código" do painel reconhece os cupons novos (mesma função do 0011, com os nomes novos)
create or replace function public.lady_validar(p_codigo text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text := upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
  v_r lady_resgates;
  v_c convite_cupons;
  v_titulo text;
  v_nome text;
begin
  if not is_admin() then
    raise exception 'sem_permissao';
  end if;
  select * into v_r from lady_resgates where codigo = v_codigo;
  if v_r.id is null then
    select * into v_c from convite_cupons where codigo = v_codigo;
    if v_c.id is null then
      raise exception 'codigo_invalido';
    end if;
    if v_c.usado_em is not null then
      raise exception 'codigo_usado';
    end if;
    if v_c.expira_em <= now() then
      raise exception 'codigo_expirado';
    end if;
    update convite_cupons set usado_em = now() where id = v_c.id;
    return json_build_object(
      'titulo', 'Cupom de ' || v_c.desconto || '% ' || case v_c.tipo
        when 'madrinha' then '(indicou 3 amigas)'
        when 'questionario' then '(respondeu o questionário)'
        when 'presente' then '(presente da Leide' || coalesce(' em ' || v_c.servico, '') || ')'
        else '(boas-vindas por convite)' end,
      'phone', v_c.phone,
      'nome', coalesce(
        (select client_name from appointments where lady_fone(client_phone) = v_c.phone order by created_at desc limit 1),
        (select nome from questionario_respostas where phone = v_c.phone),
        (select name from clients where lady_fone(phone) = v_c.phone limit 1)
      )
    );
  end if;
  if v_r.usado_em is not null then
    raise exception 'codigo_usado';
  end if;
  if v_r.expira_em <= now() then
    raise exception 'codigo_expirado';
  end if;
  update lady_resgates set usado_em = now() where id = v_r.id;
  select titulo into v_titulo from lady_metas where id = v_r.meta_id;
  select client_name into v_nome from appointments where lady_fone(client_phone) = v_r.phone order by created_at desc limit 1;
  return json_build_object('titulo', v_titulo, 'phone', v_r.phone, 'nome', v_nome);
end;
$$;

-- LGPD: apagar os dados da cliente também apaga o questionário e o histórico de mensagens
-- (mesma função do 0013, com as duas tabelas novas)
create or replace function public.lgpd_apagar_cliente(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tel text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 11);
  v_agendamentos integer;
  v_contas integer;
begin
  if not is_admin() then
    raise exception 'sem_permissao';
  end if;
  if length(v_tel) < 10 then
    raise exception 'telefone_invalido';
  end if;

  update appointments
     set client_name = 'Cliente removida', client_phone = ''
   where right(client_phone, 11) = v_tel;
  get diagnostics v_agendamentos = row_count;

  delete from auth.users u
   where u.id in (select c.user_id from contas_clientes c where right(coalesce(c.phone, ''), 11) = v_tel)
     and u.id not in (select a.user_id from admins a);
  get diagnostics v_contas = row_count;
  delete from contas_clientes where right(coalesce(phone, ''), 11) = v_tel;

  delete from lady_resgates where right(phone, 11) = v_tel;
  delete from lady_pontos where right(phone, 11) = v_tel;
  delete from lady_aparelhos where right(phone, 11) = v_tel;

  delete from convite_cupons where right(phone, 11) = v_tel;
  delete from convite_indicacoes where right(indicada_phone, 11) = v_tel;
  delete from convite_indicacoes where right(madrinha_phone, 11) = v_tel;
  delete from convite_codigos where right(phone, 11) = v_tel;

  delete from questionario_respostas where right(phone, 11) = v_tel;
  delete from crm_contatos where right(phone, 11) = v_tel;

  delete from clients where right(phone, 11) = v_tel;

  return jsonb_build_object('agendamentos', v_agendamentos, 'contas', v_contas);
end;
$$;

-- Permissões (desde o 0015 toda função nova nasce fechada)
revoke all on function public.questionario_texto(text) from public, anon, authenticated;
revoke all on function public.questionario_responder(text, text, text, date, text[], jsonb, boolean) from public;
revoke all on function public.crm_follow_up(text, text, text, integer, integer, text) from public, anon;
revoke all on function public.lady_validar(text) from public, anon;
revoke all on function public.lgpd_apagar_cliente(text) from public, anon;
grant execute on function public.questionario_responder(text, text, text, date, text[], jsonb, boolean) to anon, authenticated;
grant execute on function public.crm_follow_up(text, text, text, integer, integer, text) to authenticated;
grant execute on function public.lady_validar(text) to authenticated;
grant execute on function public.lgpd_apagar_cliente(text) to authenticated;
