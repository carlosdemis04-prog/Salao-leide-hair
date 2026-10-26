# Login com Google: passo a passo

Este guia liga o botão **Continuar com o Google** do app (`/app`) e o **Entrar com o Google** do painel (`/painel`).
São 3 partes: Google Cloud (cria a "chave" do login), Supabase (recebe essa chave) e o banco (migração 0012).
Leva uns 20 minutos. Faça tudo pelo computador.

Endereços que você vai usar (copie e cole exatamente):

| O quê | Endereço |
| --- | --- |
| Site | `https://salao-leide-hair.carlosdemis04.workers.dev` |
| Volta do Google (callback) | `https://rxozyjdtnkzdsrafizxu.supabase.co/auth/v1/callback` |
| Domínio do Supabase | `rxozyjdtnkzdsrafizxu.supabase.co` |

> A **chave secreta** (Client secret) do Google nunca vai no chat, no WhatsApp nem no código. Ela só é colada no Supabase.

---

## Parte 1. Google Cloud Console

### 1.1 Criar um projeto só para o salão

1. Abra [console.cloud.google.com](https://console.cloud.google.com) e entre com a sua conta Google.
   Se aparecer a tela de termos, marque que aceita e clique em **Concordar e continuar**.
2. No alto da página, ao lado do logo "Google Cloud", clique no seletor de projeto (pode estar escrito "Selecione um projeto" ou o nome de outro projeto seu).
3. Na janela que abre, clique em **Novo projeto** (canto superior direito).
4. Em **Nome do projeto**, escreva `Leide Hair`. Deixe o resto como está e clique em **Criar**.
5. Espere uns segundos, abra o seletor de projeto de novo e escolha **Leide Hair**. Confira no alto da página que é ele que está selecionado antes de seguir. Não use o projeto do MVC.

### 1.2 Tela de consentimento (o que a cliente vê ao entrar)

1. No menu da esquerda (☰), vá em **APIs e serviços** > **Tela de permissão OAuth**.
   (Em algumas contas o nome é **Google Auth Platform**. É o mesmo lugar.)
2. Clique em **Começar** (ou **Primeiros passos**).
3. **Informações do app:**
   - Nome do app: `Leide Hair`
   - E-mail para suporte do usuário: escolha o seu e-mail na lista.
   - Clique em **Próxima**.
4. **Público:** escolha **Externo** e clique em **Próxima**.
5. **Dados de contato:** coloque o seu e-mail e clique em **Próxima**.
6. **Concluir:** marque que concorda com a política de dados do Google e clique em **Continuar** e depois em **Criar**.
7. Agora no menu da esquerda dessa área, abra **Branding** (ou **Identidade visual**) e preencha. O Google só deixa publicar com tudo isso preenchido:
   - **Nome do app:** `Leide Hair`
   - **E-mail para suporte do usuário:** o seu e-mail.
   - **Logotipo do app:** **deixe vazio.** Com logo o Google exige uma verificação que demora semanas. Sem logo, funciona na hora.
   - **Página inicial do aplicativo:** `https://salao-leide-hair.carlosdemis04.workers.dev`
   - **Link da Política de Privacidade do aplicativo:** `https://salao-leide-hair.carlosdemis04.workers.dev/privacidade.html`
   - **Link dos Termos de Serviço do aplicativo:** pode deixar vazio.
   - **Domínios autorizados:** clique em **Adicionar domínio** duas vezes e coloque um em cada linha:
     `carlosdemis04.workers.dev` e `rxozyjdtnkzdsrafizxu.supabase.co`
   - **Dados de contato do desenvolvedor:** o seu e-mail.
   - Clique em **Salvar** no fim da página.
8. Abra **Público** (ou **Audience**) no menu da esquerda e clique em **Publicar app** > **Confirmar**.
   O status deve ficar **Em produção**. Se ficar em "Teste", só e-mails cadastrados como testadores conseguem entrar e as clientes veem "Acesso bloqueado".

### 1.3 Criar o ID do cliente OAuth (a chave do login)

1. No menu da esquerda dessa área, abra **Clientes** (ou vá em **APIs e serviços** > **Credenciais** > **Criar credenciais** > **ID do cliente OAuth**).
2. Clique em **Criar cliente**.
3. **Tipo de aplicativo:** escolha **Aplicativo da Web**.
4. **Nome:** `Leide Hair site`.
5. **Origens JavaScript autorizadas** > **Adicionar URI**:
   `https://salao-leide-hair.carlosdemis04.workers.dev`
   (sem barra no final)
6. **URIs de redirecionamento autorizados** > **Adicionar URI**:
   `https://rxozyjdtnkzdsrafizxu.supabase.co/auth/v1/callback`
   (é o endereço do Supabase, não o do site. É assim mesmo.)
7. Clique em **Criar**.
8. Abre uma janela com o **ID do cliente** (termina em `.apps.googleusercontent.com`) e a **Chave secreta do cliente** (começa com `GOCSPX-`).
   Clique em **Fazer o download do JSON** para guardar as duas no seu computador. Em contas novas o Google só mostra a chave secreta uma vez.
   Deixe essa janela aberta para a Parte 2.

---

## Parte 2. Supabase

### 2.1 Ligar o Google

1. Abra [supabase.com/dashboard](https://supabase.com/dashboard) e entre no projeto do salão.
2. No menu da esquerda, clique em **Authentication** (ícone de pessoas) > **Sign In / Providers**.
3. Lá em cima, em **User Signups**, deixe **Allow new users to sign up** **ligado** (verde) e clique em **Save changes**.
   Isso é necessário: cada cliente que entra com o Google pela primeira vez vira uma conta nova. É seguro, porque uma conta nova não vê nada do painel; só quem está na tabela `admins` entra lá.
4. Desça até a lista de provedores e clique em **Google**.
5. Ligue **Enable Sign in with Google**.
6. Em **Client IDs**, cole o **ID do cliente** do Google (o que termina em `.apps.googleusercontent.com`).
7. Em **Client Secret (for OAuth)**, cole a **chave secreta** (`GOCSPX-...`).
8. Confira que o **Callback URL (for OAuth)** mostrado ali é `https://rxozyjdtnkzdsrafizxu.supabase.co/auth/v1/callback`, o mesmo da etapa 1.3.6.
9. Clique em **Save**.

### 2.2 Endereços permitidos para voltar ao site

1. Ainda em **Authentication**, clique em **URL Configuration**.
2. **Site URL:** `https://salao-leide-hair.carlosdemis04.workers.dev` e clique em **Save changes**.
3. Em **Redirect URLs**, clique em **Add URL** e cole:
   `https://salao-leide-hair.carlosdemis04.workers.dev/**`
   (os dois asteriscos no fim deixam voltar tanto para `/app` quanto para `/painel`). Clique em **Save URLs**.

### 2.3 Rodar a migração 0012

1. No menu da esquerda, abra **SQL Editor** > **New query**.
2. Abra o arquivo [`supabase/migrations/0012_login_google.sql`](../supabase/migrations/0012_login_google.sql) no GitHub, copie tudo, cole no editor e clique em **Run**.
   Deve aparecer "Success. No rows returned". Ela precisa da 0011 (Indique amigas) rodada antes.

---

## Parte 3. Testar

1. Faça o merge do PR. A Cloudflare publica sozinha em 1 ou 2 minutos, como nos outros PRs.
2. No celular ou numa janela anônima, abra `https://salao-leide-hair.carlosdemis04.workers.dev/app`.
3. Toque em **Entrar** (canto de cima do Início) > **Continuar com o Google**, escolha a conta e confirme.
4. Você volta para o app com a sua foto no lugar do "Entrar" e "Boa tarde, Seu nome!" no topo.

### Painel da Leide

- Se o e-mail de login do painel da Leide **for um Gmail** (o mesmo da conta Google dela), o botão **Entrar com o Google** do `/painel` já funciona: o Supabase junta as duas formas de entrar na mesma conta.
- Se for **outro e-mail**, peça para ela tocar uma vez em **Entrar com o Google** no `/painel` (vai aparecer "não tem acesso", é normal) e rode no **SQL Editor**, trocando pelo Gmail dela:

  ```sql
  insert into public.admins (user_id) select id from auth.users where email = 'gmail-da-leide@gmail.com';
  ```

  Na próxima vez ela entra direto. O login com e-mail e senha continua funcionando.

---

## Se der erro

| O que aparece | O que fazer |
| --- | --- |
| `Erro 400: redirect_uri_mismatch` | O endereço da etapa 1.3.6 está diferente. Tem que ser exatamente `https://rxozyjdtnkzdsrafizxu.supabase.co/auth/v1/callback`. |
| "Acesso bloqueado" ou "app não concluiu o processo de verificação" | Falta publicar o app (etapa 1.2.8). |
| Ao publicar: "complete as informações de branding" | Falta algum campo da etapa 1.2.7 (página inicial, política de privacidade, domínios ou e-mail de contato). |
| `Unsupported provider: provider is not enabled` | O Google não foi ligado ou salvo no Supabase (etapa 2.1). |
| "Signups not allowed" | **Allow new users to sign up** está desligado (etapa 2.1.3). |
| Depois de escolher a conta, volta para a página inicial do site em vez do app | Falta o endereço com `/**` em **Redirect URLs** (etapa 2.2.3). |
| Entra, mas os pontos não aparecem | Falta rodar a migração 0012 (etapa 2.3). O login funciona sem ela, só não guarda os pontos na conta. |
| App instalado no iPhone volta sem estar logado | No iPhone, o app instalado na tela de início às vezes abre o Google no Safari e volta lá. Entre pelo Safari uma vez; o resto do app continua funcionando sem login. |

## Como funciona (para quem for mexer no código)

- O login é opcional. Ninguém precisa entrar para agendar.
- `src/app/conta.ts` faz o login (`signInWithOAuth`, fluxo PKCE) e chama a função `conta_ligar` com o código do celular (`leide-app-lady`).
- `conta_ligar` (migração 0012, tabela `contas_clientes`): se a conta ainda não tem telefone e o celular já agendou, a conta fica com o telefone do celular. Se a conta já tem telefone, o celular passa a mostrar os pontos e cupons desse telefone. Depois de cada reserva feita logada, a conta é ligada de novo.
- O painel continua protegido pela tabela `admins`. Entrar com o Google não dá acesso a nada além do app.
