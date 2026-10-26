-- Corrida das Lady Points mais difícil: as metas sobem bastante (a final passa de R$ 1.000 para R$ 5.000 gastos).
-- Continua valendo R$ 1,00 = 100 pontos. Rode este arquivo no SQL Editor do Supabase (depois do 0008).
-- Pode rodar de novo sem problema.
update public.lady_metas m
set pontos = v.pontos, titulo = v.titulo, descricao = v.descricao, final = v.final, active = true
from (values
  (1, 50000, 'Cupom de 5% de desconto', 'Vale em qualquer serviço do salão.', false),
  (2, 100000, 'Cupom de 10% de desconto', 'Vale em qualquer serviço do salão.', false),
  (3, 150000, 'Design de sobrancelhas grátis', 'Um design de sobrancelhas por conta da casa.', false),
  (4, 200000, 'Cupom de 15% de desconto', 'Vale em qualquer serviço do salão.', false),
  (5, 275000, 'Escova grátis', 'Uma escova por conta da casa.', false),
  (6, 350000, 'Hidratação grátis', 'Uma hidratação por conta da casa.', false),
  (7, 425000, 'Cupom de 20% de desconto', 'Vale em qualquer serviço do salão.', false),
  (8, 500000, 'Qualquer serviço grátis', 'A grande recompensa: escolha qualquer serviço do salão, por conta da casa.', true)
) as v(ordem, pontos, titulo, descricao, final)
where m.ordem = v.ordem;
