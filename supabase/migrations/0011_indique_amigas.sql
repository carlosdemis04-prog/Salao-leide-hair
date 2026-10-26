-- Campanha "Indique amigas" (aba Eventos do app).
-- Cada cliente que já agendou pelo app tem um link de convite. Quando uma amiga abre o link e
-- agenda pela primeira vez, conta como indicação para quem convidou (a "madrinha").
-- A amiga nova ganha um cupom de 10%. A cada 3 amigas novas, a madrinha ganha um cupom de 30%.
-- Só conta telefone que nunca agendou no salão. Se a amiga cancelar, a indicação deixa de contar.
-- Os cupons são validados pela Leide no painel (/painel, aba Pontos), no mesmo campo dos códigos
-- das Lady Points.
-- Rode este arquivo inteiro no SQL Editor do Supabase (depois do 0010). Pode rodar de novo sem problema.

-- Código de convite de cada cliente (vai no link: /app?convite=CODIGO)
create table if not exists public.convite_codigos (
  phone text primary key,
  codigo text not null unique,
  created_at timestamptz not null default now()
);

-- Indicações: cada telefone novo só pode ser indicado uma vez
create table if not exists public.convite_indicacoes (
  id uuid primary key default gen_random_uuid(),
  madrinha_phone text not null,
  indicada_phone text not null unique,
  reserva_id uuid references public.appointments(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists convite_indicacoes_madrinha on public.convite_indicacoes (madrinha_phone);

-- Cupons da campanha: boas_vindas (10%, amiga nova) e madrinha (30%, a cada 3 amigas)
create table if not exists public.convite_cupons (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  tipo text not null check (tipo in ('boas_vindas', 'madrinha')),
  desconto integer not null check (desconto between 1 and 100),
  codigo text not null unique,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  usado_em timestamptz
);
create index if not exists convite_cupons_phone on public.convite_cupons (phone);

alter table public.convite_codigos enable row level security;
alter table public.convite_indicacoes enable row level security;
alter table public.convite_cupons enable row level security;

-- A cliente só chega aqui pelas funções abaixo. A Leide (admin) vê e corrige tudo.
grant select, insert, update, delete on public.convite_codigos, public.convite_indicacoes, public.convite_cupons to authenticated;

drop policy if exists "admin gerencia convites" on public.convite_codigos;
create policy "admin gerencia convites" on public.convite_codigos
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admin gerencia indicacoes" on public.convite_indicacoes;
create policy "admin gerencia indicacoes" on public.convite_indicacoes
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admin gerencia cupons de convite" on public.convite_cupons;
create policy "admin gerencia cupons de convite" on public.convite_cupons
  for all to authenticated using (is_admin()) with check (is_admin());

-- Código de 6 letras sem as que se confundem (0/O, 1/I), diferente de todos os códigos já usados
create or replace function public.convite_novo_codigo()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_letras constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_codigo text;
begin
  loop
    v_codigo := '';
    for i in 1..6 loop
      v_codigo := v_codigo || substr(v_letras, 1 + floor(random() * length(v_letras))::integer, 1);
    end loop;
    exit when not exists (select 1 from lady_resgates where codigo = v_codigo)
      and not exists (select 1 from convite_cupons where codigo = v_codigo)
      and not exists (select 1 from convite_codigos where codigo = v_codigo);
  end loop;
  return v_codigo;
end;
$$;

-- Indicações que valem: a amiga agendou e não cancelou
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
  where i.madrinha_phone = p_phone and a.status <> 'cancelado';
$$;

-- Dá à madrinha um cupom de 30% a cada 3 indicações que valem (nunca tira um cupom já dado)
create or replace function public.convite_premiar(p_phone text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_falta integer;
begin
  v_falta := convite_validas(p_phone) / 3
    - (select count(*) from convite_cupons where phone = p_phone and tipo = 'madrinha');
  for i in 1..greatest(v_falta, 0) loop
    insert into convite_cupons (phone, tipo, desconto, codigo, expira_em)
    values (p_phone, 'madrinha', 30, convite_novo_codigo(), now() + interval '90 days');
  end loop;
end;
$$;

-- Primeiro nome da cliente, pela reserva mais recente
create or replace function public.convite_nome(p_phone text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select split_part(trim(a.client_name), ' ', 1)
  from appointments a
  where lady_fone(a.client_phone) = p_phone
  order by a.created_at desc
  limit 1;
$$;

-- App: o convite da cliente, as amigas que ela trouxe e os cupons dela
create or replace function public.convite_meu(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_codigo text;
begin
  select phone into v_phone from lady_aparelhos where token = p_token;
  if v_phone is null then
    return json_build_object('participando', false);
  end if;

  select codigo into v_codigo from convite_codigos where phone = v_phone;
  if v_codigo is null then
    v_codigo := convite_novo_codigo();
    insert into convite_codigos (phone, codigo) values (v_phone, v_codigo)
    on conflict (phone) do nothing;
    select codigo into v_codigo from convite_codigos where phone = v_phone;
  end if;

  perform convite_premiar(v_phone);

  return json_build_object(
    'participando', true,
    'codigo', v_codigo,
    'nome', convite_nome(v_phone),
    'validas', convite_validas(v_phone),
    'amigas', coalesce((
      select json_agg(json_build_object(
        'nome', split_part(trim(coalesce(a.client_name, 'Amiga')), ' ', 1),
        'quando', i.created_at,
        'situacao', case
          when a.id is null or a.status = 'cancelado' then 'cancelou'
          when a.status = 'concluido' then 'veio'
          else 'agendou'
        end
      ) order by i.created_at desc)
      from convite_indicacoes i
      left join appointments a on a.id = i.reserva_id
      where i.madrinha_phone = v_phone
    ), '[]'::json),
    'cupons', coalesce((
      select json_agg(json_build_object(
        'codigo', c.codigo,
        'tipo', c.tipo,
        'desconto', c.desconto,
        'expira_em', c.expira_em,
        'usado_em', c.usado_em
      ) order by c.criado_em desc)
      from convite_cupons c
      where c.phone = v_phone
    ), '[]'::json)
  );
end;
$$;

-- App: quem convidou (só o primeiro nome), para a tela de boas-vindas da amiga
create or replace function public.convite_info(p_codigo text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object('nome', convite_nome(c.phone))
  from convite_codigos c
  where c.codigo = upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
$$;

-- App: a amiga agendou pelo link. Conta a indicação e dá o cupom de 10% para ela.
-- Devolve { ok: true, cupom } ou { ok: false, motivo }.
create or replace function public.convite_registrar(p_codigo text, p_reserva uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_madrinha text;
  v_phone text;
  v_criada timestamptz;
  v_codigo text;
  v_expira timestamptz;
begin
  select phone into v_madrinha from convite_codigos
  where codigo = upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
  if v_madrinha is null then
    return json_build_object('ok', false, 'motivo', 'codigo_invalido');
  end if;

  select lady_fone(client_phone), created_at into v_phone, v_criada from appointments where id = p_reserva;
  -- Só vale a reserva que acabou de ser feita
  if v_phone is null or v_criada < now() - interval '1 hour' then
    return json_build_object('ok', false, 'motivo', 'reserva_invalida');
  end if;
  if v_phone = v_madrinha then
    return json_build_object('ok', false, 'motivo', 'propria');
  end if;
  -- Nova cliente = telefone que nunca agendou antes desta reserva
  if exists (select 1 from appointments where lady_fone(client_phone) = v_phone and id <> p_reserva)
     or exists (select 1 from convite_indicacoes where indicada_phone = v_phone) then
    return json_build_object('ok', false, 'motivo', 'ja_cliente');
  end if;

  insert into convite_indicacoes (madrinha_phone, indicada_phone, reserva_id)
  values (v_madrinha, v_phone, p_reserva);

  v_codigo := convite_novo_codigo();
  v_expira := now() + interval '60 days';
  insert into convite_cupons (phone, tipo, desconto, codigo, expira_em)
  values (v_phone, 'boas_vindas', 10, v_codigo, v_expira);

  perform convite_premiar(v_madrinha);

  return json_build_object(
    'ok', true,
    'madrinha', convite_nome(v_madrinha),
    'cupom', json_build_object('codigo', v_codigo, 'tipo', 'boas_vindas', 'desconto', 10, 'expira_em', v_expira, 'usado_em', null)
  );
exception when unique_violation then
  return json_build_object('ok', false, 'motivo', 'ja_cliente');
end;
$$;

-- Painel: a campanha inteira (madrinhas, amigas e cupons que ainda valem)
create or replace function public.convite_painel()
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'sem_permissao';
  end if;
  -- Garante que todo cupom de 30% já merecido exista
  perform convite_premiar(m.madrinha_phone)
  from (select distinct madrinha_phone from convite_indicacoes) m;

  return json_build_object(
    'indicacoes', coalesce((
      select json_agg(json_build_object(
        'madrinha', convite_nome(i.madrinha_phone),
        'madrinha_phone', i.madrinha_phone,
        'amiga', a.client_name,
        'amiga_phone', i.indicada_phone,
        'quando', i.created_at,
        'status', coalesce(a.status, 'cancelado')
      ) order by i.created_at desc)
      from (select * from convite_indicacoes order by created_at desc limit 30) i
      left join appointments a on a.id = i.reserva_id
    ), '[]'::json),
    'cupons', coalesce((
      select json_agg(json_build_object(
        'codigo', c.codigo,
        'tipo', c.tipo,
        'desconto', c.desconto,
        'nome', convite_nome(c.phone),
        'phone', c.phone,
        'expira_em', c.expira_em
      ) order by c.criado_em desc)
      from convite_cupons c
      where c.usado_em is null and c.expira_em > now()
    ), '[]'::json)
  );
end;
$$;

-- O "Validar código" do painel agora aceita também os cupons do convite
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
      'titulo', case when v_c.tipo = 'madrinha'
        then 'Cupom de ' || v_c.desconto || '% (indicou 3 amigas)'
        else 'Cupom de ' || v_c.desconto || '% (boas-vindas por convite)' end,
      'phone', v_c.phone,
      'nome', (select client_name from appointments where lady_fone(client_phone) = v_c.phone order by created_at desc limit 1)
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

revoke all on function public.convite_novo_codigo() from public;
revoke all on function public.convite_validas(text) from public;
revoke all on function public.convite_premiar(text) from public;
revoke all on function public.convite_nome(text) from public;
revoke all on function public.convite_meu(uuid) from public;
revoke all on function public.convite_info(text) from public;
revoke all on function public.convite_registrar(text, uuid) from public;
revoke all on function public.convite_painel() from public;
revoke all on function public.lady_validar(text) from public;
-- Supabase dá acesso às funções novas para anon por padrão: tira das funções internas
revoke all on function public.convite_novo_codigo() from anon, authenticated;
revoke all on function public.convite_validas(text) from anon, authenticated;
revoke all on function public.convite_premiar(text) from anon, authenticated;
revoke all on function public.convite_nome(text) from anon, authenticated;
grant execute on function public.convite_meu(uuid) to anon, authenticated;
grant execute on function public.convite_info(text) to anon, authenticated;
grant execute on function public.convite_registrar(text, uuid) to anon, authenticated;
grant execute on function public.convite_painel() to authenticated;
grant execute on function public.lady_validar(text) to authenticated;
