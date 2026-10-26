-- Login com Google para as clientes do app (/app).
-- A conta do Google guarda o telefone (WhatsApp) da cliente. Assim, quando ela entra com o Google
-- em outro celular, os Lady Points e os cupons do "Indique amigas" aparecem lá também.
-- Rode este arquivo inteiro no SQL Editor do Supabase (depois do 0011). Pode rodar de novo sem problema.

create table if not exists public.contas_clientes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ninguém lê a tabela direto: só pelas funções abaixo
alter table public.contas_clientes enable row level security;

-- Liga a conta do Google ao celular (o código aleatório que o app guarda).
-- Conta sem telefone + celular que já agendou: a conta passa a ter o telefone do celular.
-- Conta com telefone: o celular passa a mostrar os pontos desse telefone.
create or replace function public.conta_ligar(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_conta text;
  v_aparelho text;
begin
  if v_uid is null then
    raise exception 'sem_login';
  end if;

  select phone into v_conta from contas_clientes where user_id = v_uid;
  if p_token is not null then
    select phone into v_aparelho from lady_aparelhos where token = p_token;
  end if;
  v_conta := coalesce(v_conta, v_aparelho);

  insert into contas_clientes (user_id, phone) values (v_uid, v_conta)
  on conflict (user_id) do update
    set phone = coalesce(excluded.phone, contas_clientes.phone), updated_at = now();

  if v_conta is not null and p_token is not null then
    insert into lady_aparelhos (token, phone) values (p_token, v_conta)
    on conflict (token) do update set phone = excluded.phone;
  end if;

  return jsonb_build_object('phone', v_conta);
end;
$$;

revoke all on function public.conta_ligar(uuid) from public;
grant execute on function public.conta_ligar(uuid) to authenticated;
