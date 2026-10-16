# Leide Hair · Agendamento

Site de agendamento do Salão Leide Hair, feito para abrir no celular. A cliente escolhe o serviço, o dia e o horário livre, informa nome e WhatsApp e o horário fica reservado.

Feito com React + Vite e [Supabase](https://supabase.com) (banco de dados).

## Configurar o Supabase (uma vez só)

No painel do Supabase, abra **SQL Editor** e rode, nesta ordem, o conteúdo de cada arquivo (cole e clique em **Run**):

1. [`supabase/migrations/0001_agendamento.sql`](supabase/migrations/0001_agendamento.sql): cria as tabelas e as funções.
2. [`supabase/migrations/0002_servicos_reais.sql`](supabase/migrations/0002_servicos_reais.sql): permite serviço sem preço definido.
3. [`supabase/seed.sql`](supabase/seed.sql): cadastra os serviços e o horário (segunda a sábado, 9h às 18h). Pode rodar de novo sempre que mudar algo nele.

Depois é possível ajustar preços, durações e horários direto no **Table Editor**.

### Onde a Leide edita as coisas (Table Editor)

| Tabela | Para quê |
| --- | --- |
| `services` | Serviços, preço (em centavos: R$ 60,00 = `6000`; vazio = "Valor a consultar") e duração em minutos. Desmarque `active` para esconder um serviço. |
| `business_hours` | Horário de atendimento por dia da semana (0 = domingo, 6 = sábado). Pode ter duas linhas no mesmo dia para o almoço. |
| `blocked_times` | Folgas, feriados e compromissos. O site não oferece horários nesses períodos. |
| `appointments` | Os agendamentos feitos pelo site. |

## Rodar no computador

```bash
cp .env.example .env.local   # e preencha a URL e a chave pública do Supabase
npm install
npm run dev
```

## Segurança

O site usa só a chave pública do Supabase. Ele lê os serviços e os horários de atendimento, mas **não** lê os agendamentos de outras clientes: os horários livres e a criação do agendamento passam por duas funções do banco (`get_available_slots` e `book_appointment`), que conferem se o horário está livre. Uma trava no banco impede dois agendamentos no mesmo horário.
