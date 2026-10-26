-- Painel da Leide, parte 2: valor cobrado em cada atendimento, clientes (CRM) e despesas.
-- Rode este arquivo inteiro no SQL Editor do Supabase (depois do 0008).
-- Pode rodar de novo sem problema.

-- Quanto a cliente pagou de fato e como pagou. Preenchido quando a Leide marca "Atendida".
alter table public.appointments add column if not exists amount_cents integer check (amount_cents >= 0);
alter table public.appointments add column if not exists payment_method text
  check (payment_method in ('pix', 'dinheiro', 'cartao', 'outro'));

-- Clientes: uma linha por WhatsApp. Nasce sozinha no primeiro agendamento
-- e a Leide completa com aniversário, como conheceu o salão e anotações.
create table if not exists public.clients (
  phone text primary key check (phone ~ '^\d{10,13}$'),
  name text not null,
  birthday date,
  origin text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;
grant select, insert, update, delete on public.clients to authenticated;

drop policy if exists "admin gerencia clientes" on public.clients;
create policy "admin gerencia clientes" on public.clients
  for all to authenticated using (is_admin()) with check (is_admin());

create or replace function public.registrar_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_phone ~ '^\d{10,13}$' then
    insert into clients (phone, name, created_at)
    values (new.client_phone, new.client_name, new.created_at)
    on conflict (phone) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_registra_cliente on public.appointments;
create trigger appointments_registra_cliente
  after insert on public.appointments
  for each row execute function public.registrar_cliente();

-- Quem já agendou antes deste arquivo também entra na lista (com o nome mais recente)
insert into public.clients (phone, name, created_at)
select distinct on (client_phone) client_phone, client_name, min(created_at) over (partition by client_phone)
from public.appointments
where client_phone ~ '^\d{10,13}$'
order by client_phone, created_at desc
on conflict (phone) do nothing;

-- Despesas do salão (produtos, aluguel, luz...). Servem para calcular o lucro.
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null default (now() at time zone 'America/Sao_Paulo')::date,
  description text not null check (length(description) between 1 and 120),
  category text not null default 'outros'
    check (category in ('produtos', 'aluguel', 'contas', 'equipamentos', 'divulgacao', 'outros')),
  amount_cents integer not null check (amount_cents > 0),
  created_at timestamptz not null default now()
);

alter table public.expenses enable row level security;
grant select, insert, update, delete on public.expenses to authenticated;

drop policy if exists "admin gerencia despesas" on public.expenses;
create policy "admin gerencia despesas" on public.expenses
  for all to authenticated using (is_admin()) with check (is_admin());
