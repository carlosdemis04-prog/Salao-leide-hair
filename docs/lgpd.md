# LGPD e outras regras: o que já está certo e o que falta

> **Importante:** este guia é uma orientação prática feita a partir do código do site, não é aconselhamento jurídico. Para ter certeza, principalmente antes de começar a cobrar pelo app, vale uma conversa rápida com um advogado ou com o Sebrae (que tem atendimento gratuito para pequenos negócios).

Atualizado em 28 de outubro de 2026.

## Resumo

O site, o app e o painel já coletam pouca coisa e não usam rastreadores de propaganda, o que facilita muito. O que faltava era **avisar direito** (políticas e termos), **dar um jeito fácil de apagar os dados** de quem pedir e alguns cuidados no dia a dia. Isso foi feito nesta atualização. Sobram algumas coisas que só o Carlos e a Leide podem fazer, listadas no fim.

## O que foi verificado

| Ponto | Situação |
| --- | --- |
| Login com Google | Pede só nome, e-mail e foto (o mínimo do Google). Não lê contatos, agenda nem Gmail da cliente. É opcional. **OK.** |
| Ligação da conta Google com o telefone (pontos) | Está explicada na política e serve só para os pontos. **OK.** |
| Agendamento | Pede só nome e WhatsApp. **OK.** Faltava o aviso com link para os termos e a privacidade: **colocado.** |
| Cookies | Não há Google Analytics, pixel do Facebook nem nada parecido. Só dados técnicos no próprio celular. Por isso **não precisa de banner "aceitar cookies"**, só da política explicando (feita). |
| Fontes do Google | As letras do site vêm do Google, que recebe o IP de quem abre o site. Está avisado na política. Dá para trazer as fontes para dentro do site no futuro e tirar isso. |
| Assistente com IA do painel | Recebe só totais do salão (quanto entrou no mês etc.), nunca nome ou telefone de cliente. **OK.** |
| Google Agenda da Leide | Recebe nome e WhatsApp da cliente para a Leide se organizar. Está avisado na política. **OK.** |
| Ficha da cliente no painel | O exemplo do campo "Anotações" sugeria anotar alergias e nome dos filhos. Alergia é dado de saúde (dado sensível na LGPD) e nome de filho é dado de criança. **O exemplo foi trocado** e entrou um lembrete. |
| Apagar dados a pedido | Não existia jeito. **Agora tem o botão "Apagar dados da cliente"** na ficha (precisa rodar a migração 0013). |
| Indique amigas e cupons | Regras agora escritas nos termos (validade, quem conta, não acumula, não vira dinheiro). O Código de Defesa do Consumidor exige que as regras de uma promoção sejam claras e cumpridas como anunciadas. |
| Lady Points | Regras escritas nos termos, com a garantia de que pontos e prêmios já ganhos não são tirados se as metas mudarem. |

## O que esta atualização colocou

- **Política de privacidade** completa (`/privacidade.html`): quem é a responsável, quais dados, para quê e com qual base da lei, com quem compartilha, por quanto tempo guarda, direitos da cliente, segurança, menores de idade.
- **Política de cookies** (`/cookies.html`): lista tudo que o app guarda no celular.
- **Termos de uso** (`/termos.html`): agendamento, preço informado antes do serviço, cancelamento grátis, Lady Points, Indique amigas, cupons e ofertas.
- **Links** no rodapé do site, na aba Contato do app, na tela de login do painel, embaixo do botão "Confirmar agendamento" (site e app) e na tela "Entre com o Google" do app.
- **Botão "Apagar dados da cliente"** na ficha da cliente no painel.

## O que o Carlos precisa fazer

1. **Rodar a migração 0013** no Supabase: SQL Editor > New query > colar o conteúdo de `supabase/migrations/0013_lgpd_apagar_cliente.sql` > Run. Sem ela o botão de apagar mostra um aviso.
2. **Google Cloud > Branding** (projeto Leide Hair): no campo de link dos termos de serviço, colocar `https://salao-leide-hair.carlosdemis04.workers.dev/termos.html`. A política de privacidade continua em `/privacidade.html`.
3. **Mandar o CNPJ (ou MEI) e o nome completo da Leide**, se ela tiver. A lei do comércio eletrônico (Decreto 7.962/2013) pede que o site mostre o nome e o CNPJ ou CPF de quem vende. Hoje o site só agenda (não vende), então o risco é baixo, mas **isso passa a ser obrigatório quando o app começar a cobrar**. Eu coloco nas páginas quando receber.

## Cuidados da Leide no dia a dia

1. **Quando uma cliente pedir para ver ou apagar os dados**, responder em até 15 dias. Para apagar: painel > Clientes > nome da cliente > **Apagar dados da cliente**. Para ver: mandar a ela o que aparece na ficha.
2. **Mensagens de aniversário e de ofertas**: se a cliente pedir para não receber, parar e anotar isso na ficha. Nada de mandar para listas compradas ou para quem nunca foi cliente.
3. **Anotações na ficha**: só o que ajuda no atendimento (cor, produto, preferências). Alergia ou outro dado de saúde, só se a cliente concordar. Nada de dados dos filhos.
4. **Fotos de clientes no Instagram** (antes e depois): pedir autorização antes, por escrito (uma mensagem no WhatsApp com "pode postar" já ajuda). Usar a imagem de alguém sem autorização pode gerar indenização (Código Civil, art. 20).
5. **Preços**: o Código de Defesa do Consumidor (art. 40) pede que o valor seja informado **antes** do serviço, e a lei de preços (Lei 10.962/2004) pede tabela de preços visível no salão. Os termos já dizem que a Leide informa o valor antes de começar. Vale ter uma tabela na parede e, quando quiser, mostrar no app pelo menos "a partir de R$ X".
6. **Ofertas e cupons**: o que for anunciado tem que ser cumprido (CDC, art. 30 e 35). Em "de R$ X por R$ Y", o "de" precisa ser o preço real de antes.
7. **Senhas e chaves**: nunca mandar por chat, print ou e-mail. Se alguma vazar, trocar na hora. Se houver vazamento de dados de clientes, avisar a ANPD e as clientes (a ANPD pede em até 3 dias úteis).

## Antes de ligar o pagamento pelo app (Mercado Pago)

- Colocar o CNPJ/CPF e o nome completo nas páginas (item 3 acima).
- Escrever nos termos a regra de reembolso e de cancelamento de serviço pago antes. Compra feita pela internet tem **direito de arrependimento de 7 dias** (CDC, art. 49), então a regra precisa respeitar isso.
- Atualizar a política de privacidade dizendo que o Mercado Pago recebe os dados do pagamento. Os dados do cartão ficam com o Mercado Pago, nunca no banco do salão.

## Registro simples do que é feito com os dados

A LGPD (art. 37) pede que o negócio registre o que faz com os dados. Para negócio pequeno, a ANPD aceita um registro simplificado. Este quadro serve como esse registro:

| Dado | De onde vem | Para que | Onde fica | Quem vê | Quanto tempo |
| --- | --- | --- | --- | --- | --- |
| Nome e WhatsApp | Agendamento | Marcar e confirmar horário | Supabase, Google Agenda da Leide | Leide | Enquanto for cliente; histórico até 5 anos |
| Nome, e-mail e foto do Google | Login opcional | Guardar pontos em qualquer celular | Supabase | Só o sistema | Até pedir para apagar |
| Pontos, prêmios, cupons, convites | App e painel | Lady Points e Indique amigas | Supabase | Leide e a própria cliente | Enquanto valerem |
| Valor pago e forma de pagamento | Painel | Controle do caixa | Supabase | Leide | Até 5 anos |
| Aniversário, como conheceu, anotações | Painel (se a cliente quiser) | Atendimento e mensagem de aniversário | Supabase | Leide | Enquanto for cliente |

Responsável: Leide (Leide Hair). Canal para as clientes: WhatsApp (11) 92229-7887. Negócio pequeno não precisa nomear um "encarregado" (Resolução ANPD 2/2022), mas precisa desse canal, que já está nas páginas.
