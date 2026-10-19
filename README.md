# Leide Hair · Agendamento

Site de agendamento do Salão Leide Hair, feito para abrir no celular. A cliente escolhe o serviço, o dia e o horário livre, informa nome e WhatsApp e o horário fica reservado.

Feito com React + Vite e [Supabase](https://supabase.com) (banco de dados).

## Configurar o Supabase (uma vez só)

No painel do Supabase, abra **SQL Editor** e rode, nesta ordem, o conteúdo de cada arquivo (cole e clique em **Run**):

1. [`supabase/migrations/0001_agendamento.sql`](supabase/migrations/0001_agendamento.sql): cria as tabelas e as funções.
2. [`supabase/migrations/0002_servicos_reais.sql`](supabase/migrations/0002_servicos_reais.sql): permite serviço sem preço definido.
3. [`supabase/seed.sql`](supabase/seed.sql): cadastra os serviços e o horário (segunda a sábado, 9h às 18h). Rode só na primeira vez; depois ajuste tudo pelo painel.

4. [`supabase/migrations/0003_painel.sql`](supabase/migrations/0003_painel.sql): cria o acesso ao painel da Leide e o link para o Google Agenda.

## Painel da Leide (`/painel`)

No endereço do site com `/painel` no final, a Leide entra com e-mail e senha e:

- vê a agenda do dia e os agendamentos **a confirmar**, e confirma ou cancela com um toque (já abre o WhatsApp da cliente com a mensagem pronta);
- marca horários de quem agendou pelo WhatsApp ou pessoalmente;
- bloqueia folgas, feriados e compromissos;
- muda preços, durações e esconde ou adiciona serviços;
- ajusta o horário de atendimento, inclusive pausa para almoço;
- pega o link para ver os agendamentos no Google Agenda.

### Criar o acesso da Leide (uma vez só)

1. No Supabase, abra **Authentication** > **Users** > **Add user** > **Create new user**. Coloque o e-mail e uma senha para a Leide, deixe marcado **Auto Confirm User** e clique em **Create user**.
2. No **SQL Editor**, rode trocando pelo e-mail dela:

   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'email-da-leide@gmail.com';
   ```

3. Recomendado: em **Authentication** > **Sign In / Providers**, desligue **Allow new users to sign up**. Mesmo ligado, uma conta nova não vê nada: só quem está na tabela `admins` entra no painel.

## Google Agenda

Na aba **Ajustes** do painel tem um link secreto (`/agenda.ics?token=...`). Colocado no Google Agenda em **Outras agendas** > **+** > **Do URL**, os agendamentos aparecem lá e no celular. O Google atualiza essa agenda a cada poucas horas, então para ver um agendamento na hora use o painel.

O link é servido pelo worker em [`worker/index.js`](worker/index.js), que chama a função `calendar_feed` do banco. A função só responde com o token certo.

## Rodar no computador

```bash
cp .env.example .env.local   # e preencha a URL e a chave pública do Supabase
npm install
npm run dev
```

## Segurança

O site usa só a chave pública do Supabase. Ele lê os serviços e os horários de atendimento, mas **não** lê os agendamentos de outras clientes: os horários livres e a criação do agendamento passam por duas funções do banco (`get_available_slots` e `book_appointment`), que conferem se o horário está livre. Uma trava no banco impede dois agendamentos no mesmo horário.

O painel usa a mesma chave pública, com login. As regras do banco (RLS) só liberam agendamentos, folgas, serviços e horário para quem está na tabela `admins`.
