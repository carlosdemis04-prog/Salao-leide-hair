-- Serviços e horário do Salão Leide Hair.
-- Pode rodar de novo sempre que quiser: atualiza o que já existe.
-- Preço em centavos (R$ 60,00 = 6000). null = "Valor a consultar".
-- Duração em minutos: define quanto tempo o horário fica ocupado na agenda.

insert into public.services (name, description, price_cents, duration_min, sort_order) values
  ('Corte', null, null, 60, 1),
  ('Escova', null, null, 60, 2),
  ('Hidratação', null, null, 60, 3),
  ('Coloração', null, null, 120, 4),
  ('Luzes', null, null, 180, 5),
  ('Progressiva', null, null, 180, 6),
  ('Botox', null, null, 120, 7),
  ('Selagem', null, null, 150, 8),
  ('Manicure e pedicure', null, null, 90, 9),
  ('Depilação', null, null, 60, 10),
  ('Design de sobrancelhas', null, null, 30, 11),
  ('Estética facial e corporal', null, null, 60, 12)
on conflict (name) do update set
  description = excluded.description,
  price_cents = excluded.price_cents,
  duration_min = excluded.duration_min,
  sort_order = excluded.sort_order,
  active = true;

-- Esconde serviços que não estão na lista acima (ex.: os exemplos antigos)
update public.services set active = false
where name not in ('Corte', 'Escova', 'Hidratação', 'Coloração', 'Luzes', 'Progressiva', 'Botox',
                   'Selagem', 'Manicure e pedicure', 'Depilação', 'Design de sobrancelhas',
                   'Estética facial e corporal');

-- Segunda a sábado, das 9h às 18h
delete from public.business_hours;
insert into public.business_hours (weekday, open_time, close_time)
select d, '09:00', '18:00' from generate_series(1, 6) as d;
