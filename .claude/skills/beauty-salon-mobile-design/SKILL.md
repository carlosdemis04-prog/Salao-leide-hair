---
name: beauty-salon-mobile-design
description: Regras de design e de dados do app para celular do Leide Hair (/app). Use ao mexer em src/app ou na Leidinha.
---

# App para celular do Leide Hair

## Onde fica
- Tudo em `src/app/`. Entrada: `AppCelular.tsx` (abertura, 5 abas, folhas). Telas em `src/app/telas/`.
- Estilos só em `src/app/app.css`, com tokens `--a-*` em `.app`. Não reutilize nomes de classe do site (`src/index.css`): rode a checagem abaixo antes de criar classe nova.
- Mascote: `src/app/Mascote.tsx` (`humor`: oi, agendar, oferta, vazio, festa; `mini` só a cabeça).

## Direção visual
- Claro e macio: fundo `#fbf7f2`, cartões brancos, sombra leve, cantos 18px. Dourado só em detalhes (aba ativa, ícones, selos).
- Fontes do site: Instrument Serif nos títulos, Geist no resto.
- Botão principal escuro (`.botao`), secundário dourado claro (`.botao.secundario`). Toque mínimo de 44px.
- Sem 3D, sem efeitos de cinema, sem glassmorphism. A Leidinha aparece pequena: abertura, banner, estados vazios e confirmação.

## Leidinha
- Vem da logo: cabelo longo que voa para a direita e sobe na ponta, mechas enroladas à esquerda, pente e tesoura dourados, degradê pêssego para amarelo.
- Sempre a mesma personagem; mude só olhos, boca, braços e acessório.

## Dados (nunca inventar)
- Serviços, horário, horários livres e reserva vêm do Supabase (`get_available_slots`, `book_appointment`).
- Ofertas e eventos vêm das tabelas `offers` e `events` (migração 0005). Sem dados, mostrar o estado vazio.
- "Meu agendamento" guarda só o código da reserva no aparelho e consulta `consultar_reserva`; cancelar usa `cancelar_reserva` (até 2h antes).
- Contato real: WhatsApp (11) 92229-7887, @leidehair_beauty, Rua Silvestre Francisco Puglia, 26, Campininha.

## Checagens
- Conflito de classes: `for c in $(grep -ohE "^\.[a-z][a-z0-9-]*" src/app/app.css | sort -u | tr -d .); do grep -qE "\.$c([^a-zA-Z0-9_-]|$)" src/index.css && echo $c; done`
- Testar em 375px e 412px de largura, sem rolagem lateral, com a barra de baixo sem cobrir botões.
- `npm run build` sem erros.
