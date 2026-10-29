# Leide Hair · Agendamento

Site de agendamento do Salão Leide Hair, feito para abrir no celular. A cliente escolhe o serviço, o dia e o horário livre, informa nome e WhatsApp e o horário fica reservado.

Feito com React + Vite e [Supabase](https://supabase.com) (banco de dados).

## Configurar o Supabase (uma vez só)

No painel do Supabase, abra **SQL Editor** e rode, nesta ordem, o conteúdo de cada arquivo (cole e clique em **Run**):

1. [`supabase/migrations/0001_agendamento.sql`](supabase/migrations/0001_agendamento.sql): cria as tabelas e as funções.
2. [`supabase/migrations/0002_servicos_reais.sql`](supabase/migrations/0002_servicos_reais.sql): permite serviço sem preço definido.
3. [`supabase/seed.sql`](supabase/seed.sql): cadastra os serviços e o horário (terça a sábado, 9h às 18h). Rode só na primeira vez; depois ajuste tudo pelo painel.

4. [`supabase/migrations/0003_painel.sql`](supabase/migrations/0003_painel.sql): cria o acesso ao painel da Leide e o link para o Google Agenda.
5. [`supabase/migrations/0004_google_agenda.sql`](supabase/migrations/0004_google_agenda.sql): prepara a ligação direta com o Google Agenda (veja abaixo).
6. [`supabase/migrations/0005_app_celular.sql`](supabase/migrations/0005_app_celular.sql): cria as ofertas e os eventos do app e deixa a cliente ver e cancelar a própria reserva.
7. [`supabase/migrations/0006_atendimento_domiciliar.sql`](supabase/migrations/0006_atendimento_domiciliar.sql): permite evento sem data e coloca o "Atendimento domiciliar" em Eventos.
8. [`supabase/migrations/0007_terca_a_sabado.sql`](supabase/migrations/0007_terca_a_sabado.sql): tira a segunda-feira da agenda (o salão atende de terça a sábado).
9. [`supabase/migrations/0008_lady_points.sql`](supabase/migrations/0008_lady_points.sql): cria a Corrida das Lady Points (pontos, metas, resgates e códigos).
10. [`supabase/migrations/0009_painel_admin.sql`](supabase/migrations/0009_painel_admin.sql): guarda quanto cada cliente pagou, cria a lista de clientes e as despesas do painel.
11. [`supabase/migrations/0010_lady_metas_dificeis.sql`](supabase/migrations/0010_lady_metas_dificeis.sql): deixa as metas da Corrida das Lady Points mais difíceis (a final passa a pedir 500.000 pontos, ou R$ 5.000 gastos).
12. [`supabase/migrations/0011_indique_amigas.sql`](supabase/migrations/0011_indique_amigas.sql): liga a campanha Indique amigas (link de convite no app, cupom de 10% para a amiga nova e de 30% a cada 3 amigas), validada no painel.
13. [`supabase/migrations/0012_login_google.sql`](supabase/migrations/0012_login_google.sql): liga a conta Google da cliente ao WhatsApp dela, para os pontos aparecerem em qualquer celular.
14. [`supabase/migrations/0013_lgpd_apagar_cliente.sql`](supabase/migrations/0013_lgpd_apagar_cliente.sql): cria o botão **Apagar dados da cliente** na ficha do painel, para atender quem pedir a exclusão dos dados (LGPD).
15. [`supabase/migrations/0014_lady_family.sql`](supabase/migrations/0014_lady_family.sql): cria a Lady Family (10% para sempre para quem indicou 5 amigas e fez 15 serviços).
16. [`supabase/migrations/0015_seguranca.sql`](supabase/migrations/0015_seguranca.sql): fecha brechas de segurança (pontos de outra pessoa, amigas inventadas, agenda lotada por robô) e fecha as funções do painel para quem não entrou.

Privacidade e regras: o site tem [política de privacidade](public/privacidade.html), [política de cookies](public/cookies.html) e [termos de uso](public/termos.html). O que falta fazer e os cuidados do dia a dia estão em [`docs/lgpd.md`](docs/lgpd.md).

## App para celular (`/app`)

No endereço do site com `/app` no final abre a versão de aplicativo: fundo claro, navegação embaixo com **Início, Agendar, Ofertas, Eventos e Contato** e a **Leidinha**, a mascote feita a partir da mulher dourada da logo (`src/app/Mascote.tsx`).

- **Instalar:** no Android, o Chrome mostra "Instalar app" (ou use o botão no topo do Início). No iPhone, no Safari: **Compartilhar** > **Adicionar à Tela de Início**. É um app web instalável (PWA), não um app da Play Store ou da App Store.
- **Agendar:** usa os mesmos horários livres e a mesma reserva do site. Depois de reservar, o horário aparece no Início com a situação (a confirmar, confirmado ou cancelado), e a cliente pode cancelar pelo app até 2 horas antes.
- **Ofertas e eventos:** aparecem só os que estiverem cadastrados. O cadastro é no painel, na aba **Divulgar** (com ou sem o assistente). Sem nada cadastrado, as abas mostram um aviso com a Leidinha.
- **Corrida das Lady Points:** no topo de Ofertas. Cada R$ 1,00 pago vale 100 pontos, e os pontos nunca são gastos: cada meta alcançada libera uma recompensa, que a cliente resgata uma vez. O resgate mostra um código que vale por 24 horas. A cliente entra na corrida ao agendar pelo app (os pontos ficam ligados ao telefone da reserva). As metas ficam no Supabase, em **Table Editor** > `lady_metas`.
- **Frase do topo:** fica em `FRASE`, no arquivo `src/app/telas/Inicio.tsx`.
- **Entrar com o Google (opcional):** o botão **Entrar** no topo do Início. Com a conta, os Lady Points e os cupons acompanham a cliente em qualquer celular, e o nome e o WhatsApp já vêm preenchidos ao agendar. Para ligar, siga o passo a passo em [`docs/login-google.md`](docs/login-google.md).

## Painel da Leide (`/painel`)

No endereço do site com `/painel` no final, a Leide entra com e-mail e senha ou com o Google (veja [`docs/login-google.md`](docs/login-google.md)). As abas são **Início, Agenda, Pontos, Clientes, Divulgar e Mais**:

- **Início:** quantas clientes vêm hoje, quanto entrou, as despesas e quanto sobrou no mês (com a comparação com o mesmo período do mês passado), gráfico dos últimos 6 meses, os serviços que mais renderam, os dias mais cheios e mais vazios, lembretes para quem vem amanhã e aniversários da semana, cada um com a mensagem pronta no WhatsApp;
- **Agenda:** ao marcar **Atendida**, ela anota quanto a cliente pagou e como (Pix, dinheiro, cartão). É esse valor que entra nas contas do Início; se ficar vazio, conta o preço do serviço;
- **Clientes:** toda cliente que agenda entra sozinha na lista. Tem busca, filtros (sumidas há mais de 2 meses, aniversário no mês, mais fiéis, novas), a ficha de cada uma (aniversário, como conheceu o salão, anotações, histórico, quanto já gastou, Lady Points), mensagens prontas de WhatsApp e o botão para baixar a lista para o Excel;
- **Divulgar:** o assistente (veja abaixo) e a lista de ofertas e eventos do app, para criar, editar, esconder ou apagar;
- **Mais:** despesas do salão, folgas, serviços e preços, horário e Google Agenda.

Além disso, ela:

- vê a agenda do dia e os agendamentos **a confirmar**, e confirma ou cancela com um toque (já abre o WhatsApp da cliente com a mensagem pronta);
- marca horários de quem agendou pelo WhatsApp ou pessoalmente;
- bloqueia folgas, feriados e compromissos;
- muda preços, durações e esconde ou adiciona serviços;
- ajusta o horário de atendimento, inclusive pausa para almoço;
- pega o link para ver os agendamentos no Google Agenda;
- na aba **Pontos**: lança os Lady Points quando a cliente paga (ou pelo botão **+ Lady Points** num atendimento concluído), valida o código que a cliente mostra e vê os resgates esperando. Quando uma cliente resgata, aparece um aviso dourado no topo do painel e um número na aba.

### Assistente da aba Divulgar

A Leide escreve com as palavras dela ("faz uma promoção de escova para terça") e o assistente devolve a oferta ou o evento prontos, com o texto para WhatsApp e Instagram. Nada vai para o app sem ela apertar **Publicar no app**. Ele também conhece os números do Início, então dá para perguntar "como foi meu mês?".

Ele roda no worker da Cloudflare ([`worker/assistente.js`](worker/assistente.js)) e usa a **IA grátis da própria Cloudflare** (Workers AI, modelo Llama 3.3). Não precisa de chave nem de cartão: a ligação `"ai"` no `wrangler.jsonc` já basta. A cota grátis é de 10 mil "neurônios" por dia, o que dá algumas dezenas de conversas; se acabar, o painel avisa e ela volta no dia seguinte.

Se um dia quiser respostas melhores, dá para trocar pelo Claude, da Anthropic (pago, centavos por conversa): crie uma chave em [console.anthropic.com](https://console.anthropic.com) e coloque na Cloudflare em **Workers & Pages** > **salao-leide-hair** (não mexa no outro projeto) > **Settings** > **Variables and Secrets** > **Add**, tipo **Secret**, nome `ANTHROPIC_API_KEY`. Com a chave colocada, o assistente passa a usar o Claude sozinho. Não mande a chave por chat nem coloque no código.

### Criar o acesso da Leide (uma vez só)

1. No Supabase, abra **Authentication** > **Users** > **Add user** > **Create new user**. Coloque o e-mail e uma senha para a Leide, deixe marcado **Auto Confirm User** e clique em **Create user**.
2. No **SQL Editor**, rode trocando pelo e-mail dela:

   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'email-da-leide@gmail.com';
   ```

3. Em **Authentication** > **Sign In / Providers**, deixe **Allow new users to sign up** ligado: o login com Google das clientes precisa dele. Uma conta nova não vê nada do painel: só quem está na tabela `admins` entra lá.

## Google Agenda

### Ligação direta (recomendada)

O worker da Cloudflare ([`worker/google.js`](worker/google.js)) conversa direto com o Google Agenda da Leide:

- cada agendamento do site entra na agenda dela na hora, em amarelo enquanto está **a confirmar** e em verde depois de confirmado; cancelou no painel, some de lá;
- a cada 5 minutos ele lê os compromissos que ela marcou no Google (próximos 30 dias) e bloqueia esses horários no site. Compromissos marcados como **Livre** no Google não bloqueiam.

Para ligar (uma vez só, depois do merge e do deploy):

1. Em [console.cloud.google.com](https://console.cloud.google.com), crie um projeto (ex.: `Leide Hair`).
2. Em **APIs e serviços** > **Biblioteca**, procure **Google Calendar API** e clique em **Ativar**.
3. Em **IAM e administrador** > **Contas de serviço**, clique em **Criar conta de serviço**, dê um nome (ex.: `site-leide-hair`) e conclua sem escolher papéis. Copie o e-mail dela (termina em `iam.gserviceaccount.com`).
4. Abra essa conta de serviço > aba **Chaves** > **Adicionar chave** > **Criar nova chave** > **JSON**. Um arquivo `.json` é baixado. Ele é uma senha: não mande para ninguém nem cole em chat.
5. Com a conta da Leide, em [calendar.google.com](https://calendar.google.com) no computador: engrenagem > **Configurações** > a agenda dela na esquerda > **Compartilhar com pessoas específicas** > **Adicionar pessoas**. Cole o e-mail da conta de serviço, escolha **Fazer alterações nos eventos** e envie.
6. No Supabase, rode o `0004_google_agenda.sql` (item 5 acima) e depois `select google_token from settings;`. Copie o código que aparecer.
7. Na Cloudflare, abra **Workers e Pages** > **salao-leide-hair** > **Configurações** > **Variáveis e segredos** e adicione três itens do tipo **Segredo**:
   - `GOOGLE_SERVICE_ACCOUNT`: o conteúdo inteiro do arquivo `.json` (abra no bloco de notas, copie tudo e cole);
   - `GOOGLE_CALENDAR_ID`: o Gmail da Leide;
   - `GOOGLE_SYNC_TOKEN`: o código do passo 6.
8. Teste: faça um agendamento no site e veja se aparece na agenda da Leide. Depois tire a agenda assinada pelo link `.ics` (abaixo), senão os agendamentos aparecem duas vezes.

Se algo não funcionar, os registros ficam em **Workers e Pages** > **salao-leide-hair** > **Registros** (procure por "google agenda").

### Link da agenda (.ics)

Na aba **Ajustes** do painel tem um link secreto (`/agenda.ics?token=...`). Colocado no Google Agenda em **Outras agendas** > **+** > **Do URL**, os agendamentos aparecem lá e no celular. O Google atualiza essa agenda a cada poucas horas, então para ver um agendamento na hora use o painel. Com a ligação direta funcionando, esse link não é mais necessário.

O link é servido pelo worker em [`worker/index.js`](worker/index.js), que chama a função `calendar_feed` do banco. A função só responde com o token certo.

## Rodar no computador

```bash
cp .env.example .env.local   # e preencha a URL e a chave pública do Supabase
npm install
npm run dev
```

## Segurança

O site usa só a chave pública do Supabase. Ele lê os serviços e os horários de atendimento, mas **não** lê os agendamentos de outras clientes: os horários livres e a criação do agendamento passam por duas funções do banco (`get_available_slots` e `book_appointment`), que conferem se o horário está livre. Uma trava no banco impede dois agendamentos no mesmo horário.

A ligação com o Google também usa só a chave pública: o worker entra com o `google_token`, que só serve para as funções `google_pendentes`, `google_enviado` e `google_bloqueios`. A chave da conta de serviço do Google fica como segredo na Cloudflare, fora do código.

O painel usa a mesma chave pública, com login. As regras do banco (RLS) só liberam agendamentos, folgas, serviços e horário para quem está na tabela `admins`.
