-- Eventos sem data (ficam sempre no app) e o evento "Atendimento domiciliar".
-- Rode este arquivo inteiro no SQL Editor do Supabase (depois do 0005).
-- Pode rodar de novo sem problema.

-- Evento sem data marcada fica no app até ser desativado (coluna active)
alter table public.events alter column starts_at drop not null;

drop policy if exists "eventos ativos sao publicos" on public.events;
create policy "eventos ativos sao publicos" on public.events
  for select to anon, authenticated
  using (active and (starts_at is null or coalesce(ends_at, starts_at) >= now()));

insert into public.events (title, description, location)
select
  'Atendimento domiciliar',
  'A Leide vai até a sua casa. Combine o serviço, o dia e o horário pelo WhatsApp.',
  'Na sua casa'
where not exists (select 1 from public.events where title = 'Atendimento domiciliar');
