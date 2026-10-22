-- Corrida das Lady Points (aba Ofertas do app).
-- A cada R$ 1,00 gasto no salão, a cliente ganha 100 Lady Points (ou seja, 1 ponto por centavo).
-- Os pontos se acumulam e nunca são gastos: como num battle pass, cada meta alcançada
-- libera uma recompensa, que a cliente resgata uma vez só. O resgate gera um código com prazo,
-- e a Leide valida o código no painel (/painel, aba Lady Points).
-- Rode este arquivo inteiro no SQL Editor do Supabase (depois do 0007). Pode rodar de novo sem problema.

-- Telefone sempre do mesmo jeito: só números, sem o 55 do Brasil (DDD + número)
create or replace function public.lady_fone(p text)
returns text
language sql
immutable
as $$
  select right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 11);
$$;

-- Metas da corrida. Para mudar uma recompensa, edite aqui na tabela (Table Editor).
create table if not exists public.lady_metas (
  id uuid primary key default gen_random_uuid(),
  ordem integer not null,
  pontos integer not null check (pontos > 0),
  titulo text not null,
  descricao text,
  final boolean not null default false,
  active boolean not null default true
);

-- Extrato de pontos. A Leide lança pelo painel quando a cliente paga.
create table if not exists public.lady_pontos (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  pontos integer not null,
  valor_cents integer,
  nota text,
  created_at timestamptz not null default now()
);
create index if not exists lady_pontos_phone on public.lady_pontos (phone);

-- Celulares que entraram na corrida. O app guarda um código aleatório e o liga ao telefone
-- usando o código de uma reserva feita nele. Assim só quem agendou vê e resgata os pontos.
create table if not exists public.lady_aparelhos (
  token uuid primary key,
  phone text not null,
  created_at timestamptz not null default now()
);

-- Resgates: cada código vale por um tempo. Usado = a Leide validou no salão.
create table if not exists public.lady_resgates (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  meta_id uuid not null references public.lady_metas(id) on delete cascade,
  codigo text not null unique,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  usado_em timestamptz
);
create index if not exists lady_resgates_phone on public.lady_resgates (phone);
-- Cada recompensa só é usada uma vez por cliente
create unique index if not exists lady_resgates_usado on public.lady_resgates (phone, meta_id) where usado_em is not null;

alter table public.lady_metas enable row level security;
alter table public.lady_pontos enable row level security;
alter table public.lady_aparelhos enable row level security;
alter table public.lady_resgates enable row level security;

-- A cliente só chega aos pontos pelas funções abaixo. A Leide (admin) vê e corrige tudo.
grant select on public.lady_metas to anon, authenticated;
grant select, insert, update, delete on public.lady_metas, public.lady_pontos, public.lady_resgates to authenticated;

drop policy if exists "metas ativas sao publicas" on public.lady_metas;
create policy "metas ativas sao publicas" on public.lady_metas
  for select to anon, authenticated using (active);

drop policy if exists "admin gerencia metas" on public.lady_metas;
create policy "admin gerencia metas" on public.lady_metas
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admin gerencia pontos" on public.lady_pontos;
create policy "admin gerencia pontos" on public.lady_pontos
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admin gerencia resgates" on public.lady_resgates;
create policy "admin gerencia resgates" on public.lady_resgates
  for all to authenticated using (is_admin()) with check (is_admin());

-- Metas iniciais (só entram se a tabela estiver vazia)
insert into public.lady_metas (ordem, pontos, titulo, descricao, final)
select * from (values
  (1, 5000, 'Cupom de 5% de desconto', 'Vale em qualquer serviço do salão.', false),
  (2, 10000, 'Cupom de 10% de desconto', 'Vale em qualquer serviço do salão.', false),
  (3, 20000, 'Design de sobrancelhas grátis', 'Um design de sobrancelhas por conta da casa.', false),
  (4, 30000, 'Escova grátis', 'Uma escova por conta da casa.', false),
  (5, 45000, 'Cupom de 15% de desconto', 'Vale em qualquer serviço do salão.', false),
  (6, 60000, 'Hidratação grátis', 'Uma hidratação por conta da casa.', false),
  (7, 80000, 'Cupom de 20% de desconto', 'Vale em qualquer serviço do salão.', false),
  (8, 100000, 'Qualquer serviço grátis', 'A grande recompensa: escolha qualquer serviço do salão, por conta da casa.', true)
) as m(ordem, pontos, titulo, descricao, final)
where not exists (select 1 from public.lady_metas);

-- Liga este celular ao telefone de uma reserva feita nele
create or replace function public.lady_vincular(p_token uuid, p_reserva uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
begin
  select lady_fone(client_phone) into v_phone from appointments where id = p_reserva;
  if v_phone is null then
    raise exception 'reserva_nao_encontrada';
  end if;
  insert into lady_aparelhos (token, phone) values (p_token, v_phone)
  on conflict (token) do update set phone = excluded.phone;
end;
$$;

-- A corrida da cliente: total de pontos e a situação de cada meta.
-- situacao: bloqueada | disponivel | ativa (código válido) | usada
create or replace function public.lady_minha_corrida(p_token uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with fone as (
    select phone from lady_aparelhos where token = p_token
  ),
  total as (
    select coalesce(sum(p.pontos), 0)::integer as pontos
    from lady_pontos p where p.phone = (select phone from fone)
  )
  select json_build_object(
    'participando', exists (select 1 from fone),
    'pontos', (select pontos from total),
    'metas', coalesce((
      select json_agg(json_build_object(
        'id', m.id,
        'pontos', m.pontos,
        'titulo', m.titulo,
        'descricao', m.descricao,
        'final', m.final,
        'situacao', case
          when u.usado_em is not null then 'usada'
          when a.codigo is not null then 'ativa'
          when (select pontos from total) >= m.pontos then 'disponivel'
          else 'bloqueada'
        end,
        'codigo', a.codigo,
        'expira_em', a.expira_em,
        'usado_em', u.usado_em
      ) order by m.ordem, m.pontos)
      from lady_metas m
      left join lateral (
        select r.usado_em from lady_resgates r
        where r.meta_id = m.id and r.phone = (select phone from fone) and r.usado_em is not null
        limit 1
      ) u on true
      left join lateral (
        select r.codigo, r.expira_em from lady_resgates r
        where r.meta_id = m.id and r.phone = (select phone from fone)
          and r.usado_em is null and r.expira_em > now()
        order by r.criado_em desc
        limit 1
      ) a on true
      where m.active
    ), '[]'::json)
  );
$$;

-- Resgata uma recompensa: gera um código que vale por 24 horas.
-- Se o código vencer sem ser usado, a cliente pode resgatar de novo.
create or replace function public.lady_resgatar(p_token uuid, p_meta uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_meta lady_metas;
  v_total integer;
  v_codigo text;
  v_expira timestamptz;
  -- Sem letras e números que se confundem (0/O, 1/I)
  v_letras constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  select phone into v_phone from lady_aparelhos where token = p_token;
  if v_phone is null then
    raise exception 'fora_da_corrida';
  end if;

  select * into v_meta from lady_metas where id = p_meta and active;
  if v_meta.id is null then
    raise exception 'meta_invalida';
  end if;

  select coalesce(sum(pontos), 0) into v_total from lady_pontos where phone = v_phone;
  if v_total < v_meta.pontos then
    raise exception 'pontos_insuficientes';
  end if;

  if exists (select 1 from lady_resgates where phone = v_phone and meta_id = p_meta and usado_em is not null) then
    raise exception 'recompensa_usada';
  end if;

  -- Já tem um código valendo: devolve o mesmo
  select codigo, expira_em into v_codigo, v_expira
  from lady_resgates
  where phone = v_phone and meta_id = p_meta and usado_em is null and expira_em > now()
  order by criado_em desc
  limit 1;

  if v_codigo is null then
    loop
      v_codigo := '';
      for i in 1..6 loop
        v_codigo := v_codigo || substr(v_letras, 1 + floor(random() * length(v_letras))::integer, 1);
      end loop;
      exit when not exists (select 1 from lady_resgates where codigo = v_codigo);
    end loop;
    v_expira := now() + interval '24 hours';
    insert into lady_resgates (phone, meta_id, codigo, expira_em) values (v_phone, p_meta, v_codigo, v_expira);
  end if;

  return json_build_object('codigo', v_codigo, 'expira_em', v_expira);
end;
$$;

-- Painel: lança os pontos de um pagamento (R$ 1,00 = 100 pontos). Devolve o novo total.
create or replace function public.lady_lancar(p_phone text, p_valor_cents integer, p_nota text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := lady_fone(p_phone);
  v_total integer;
begin
  if not is_admin() then
    raise exception 'sem_permissao';
  end if;
  if length(v_phone) < 10 then
    raise exception 'telefone_invalido';
  end if;
  if p_valor_cents is null or p_valor_cents = 0 then
    raise exception 'valor_invalido';
  end if;
  insert into lady_pontos (phone, pontos, valor_cents, nota)
  values (v_phone, p_valor_cents, p_valor_cents, nullif(trim(coalesce(p_nota, '')), ''));
  select coalesce(sum(pontos), 0) into v_total from lady_pontos where phone = v_phone;
  return v_total;
end;
$$;

-- Painel: resgates esperando a Leide (códigos ainda valendo), com o nome da última reserva
create or replace function public.lady_pendentes()
returns table (codigo text, titulo text, phone text, nome text, criado_em timestamptz, expira_em timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.codigo, m.titulo, r.phone,
    (select a.client_name from appointments a where lady_fone(a.client_phone) = r.phone order by a.created_at desc limit 1),
    r.criado_em, r.expira_em
  from lady_resgates r
  join lady_metas m on m.id = r.meta_id
  where is_admin() and r.usado_em is null and r.expira_em > now()
  order by r.criado_em desc;
$$;

-- Painel: valida o código que a cliente mostrou e marca como usado
create or replace function public.lady_validar(p_codigo text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r lady_resgates;
  v_titulo text;
  v_nome text;
begin
  if not is_admin() then
    raise exception 'sem_permissao';
  end if;
  select * into v_r from lady_resgates where codigo = upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
  if v_r.id is null then
    raise exception 'codigo_invalido';
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

revoke all on function public.lady_vincular(uuid, uuid) from public;
revoke all on function public.lady_minha_corrida(uuid) from public;
revoke all on function public.lady_resgatar(uuid, uuid) from public;
revoke all on function public.lady_lancar(text, integer, text) from public;
revoke all on function public.lady_pendentes() from public;
revoke all on function public.lady_validar(text) from public;
grant execute on function public.lady_vincular(uuid, uuid) to anon, authenticated;
grant execute on function public.lady_minha_corrida(uuid) to anon, authenticated;
grant execute on function public.lady_resgatar(uuid, uuid) to anon, authenticated;
grant execute on function public.lady_lancar(text, integer, text) to authenticated;
grant execute on function public.lady_pendentes() to authenticated;
grant execute on function public.lady_validar(text) to authenticated;
