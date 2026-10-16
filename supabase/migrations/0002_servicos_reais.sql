-- Permite serviço sem preço definido (o site mostra "Valor a consultar")
-- e evita serviços repetidos com o mesmo nome.
alter table public.services alter column price_cents drop not null;
create unique index if not exists services_name_key on public.services (name);
