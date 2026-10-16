# Leide Hair · Agendamento

Site de agendamento do Salão Leide Hair, feito para abrir no celular. A cliente escolhe o serviço, o dia e o horário livre, informa nome e WhatsApp e o horário fica reservado.

Feito com React + Vite e [Supabase](https://supabase.com) (banco de dados).

## Configurar o Supabase (uma vez só)

1. No painel do Supabase, abra **SQL Editor**, cole todo o conteúdo de [`supabase/migrations/0001_agendamento.sql`](supabase/migrations/0001_agendamento.sql) e clique em **Run**.
2. Ainda no SQL Editor, rode [`supabase/seed.sql`](supabase/seed.sql). Ele cria serviços e horários **de exemplo**; depois troque pelos reais em **Table Editor**.

### Onde a Leide edita as coisas (Table Editor)

| Tabela | Para quê |
| --- | --- |
| `services` | Serviços, preço (em centavos: R$ 60,00 = `6000`) e duração em minutos. Desmarque `active` para esconder um serviço. |
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
