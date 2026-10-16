-- Dados de EXEMPLO. Troque pelos serviços, preços e horários reais da Leide.
-- Rode depois do arquivo de migração, uma vez só.

insert into public.services (name, description, price_cents, duration_min, sort_order) values
  ('Corte feminino', 'Corte com lavagem e finalização', 6000, 60, 1),
  ('Escova', 'Escova modelada', 4000, 45, 2),
  ('Hidratação', 'Hidratação profunda com escova', 7000, 60, 3),
  ('Coloração', 'Coloração completa (raiz e comprimento)', 15000, 120, 4),
  ('Progressiva', 'Escova progressiva', 25000, 180, 5),
  ('Manicure e pedicure', 'Pé e mão', 5000, 60, 6);

-- Terça a sábado, 9h às 12h e 13h às 18h
insert into public.business_hours (weekday, open_time, close_time)
select d, t.open_time, t.close_time
from generate_series(2, 6) as d
cross join (values ('09:00'::time, '12:00'::time), ('13:00'::time, '18:00'::time)) as t(open_time, close_time);
