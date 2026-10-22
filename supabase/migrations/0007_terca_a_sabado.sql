-- A Leide atende de terça a sábado: a segunda sai da agenda do site e do app.
-- Rode este arquivo no SQL Editor do Supabase. Pode rodar de novo sem problema.
-- Os horários dos outros dias ficam como estão; daqui para frente, os dias se mudam no painel (Ajustes).
delete from public.business_hours where weekday = 1;
