import { AMIGAS_PARA_ENTRAR, DESCONTO_FAMILIA, diasAte, nivel, porcentagem, SERVICOS_PARA_ENTRAR, type MinhaFamilia } from '../familia'
import { dataCurtaFmt } from '../formato'
import { Mascote } from '../Mascote'
import { depoisDeFechar, Folha } from '../ui'

function data(iso: string) {
  return dataCurtaFmt.format(new Date(iso)).replace('.', '')
}

// Barra única em porcentagem, com o nível e a frase do nível
function Progresso({ pct }: { pct: number }) {
  const n = nivel(pct)
  return (
    <div className="familia-progresso">
      <span className="familia-progresso-topo">
        <span className="familia-nivel">{n.nome}</span>
        <strong className="familia-pct">{pct}%</strong>
      </span>
      <span
        className="familia-barra-trilho"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Caminho até a família"
      >
        <span style={{ width: `${pct}%` }} />
        <i className="familia-marco" style={{ left: '50%' }} aria-hidden />
      </span>
      <span className="familia-marcos" aria-hidden>
        <span>Conhecida</span>
        <span>Quase lá</span>
        <span>Família</span>
      </span>
      <p className="familia-frase">{n.frase}</p>
    </div>
  )
}

// Cartão de destaque na aba Eventos (logo abaixo do Indique amigas)
export function FamiliaCartao({ familia, abrir }: { familia: MinhaFamilia | null | undefined; abrir: () => void }) {
  const p = familia?.participando ? familia : null
  return (
    <button className="cartao familia-cartao" onClick={abrir}>
      <span className="familia-cartao-topo">
        <span>
          <span className="familia-rotulo">{p?.membro ? 'Você é da família' : 'Programa'}</span>
          <span className="familia-nome">Lady Family</span>
        </span>
        <span className="familia-selo" aria-hidden>
          {DESCONTO_FAMILIA}%
        </span>
      </span>
      <span className="familia-cartao-texto">
        {p?.membro ? (
          <>
            Seu desconto de <strong>{DESCONTO_FAMILIA}% em todos os serviços</strong> está valendo.
          </>
        ) : (
          <>
            Indique <strong>{AMIGAS_PARA_ENTRAR} amigas</strong> e faça <strong>{SERVICOS_PARA_ENTRAR} serviços</strong>: você entra
            para a família da Leide e ganha {DESCONTO_FAMILIA}% para sempre.
          </>
        )}
      </span>
      <span className="familia-cartao-pe">
        {p && !p.membro ? (
          <span className="familia-mini">
            {porcentagem(p)}% concluído · {nivel(porcentagem(p)).nome}
          </span>
        ) : p?.membro && p.servico_ate ? (
          <span className="familia-mini">Próximo serviço até {data(p.servico_ate)}</span>
        ) : (
          <span className="familia-mini">Desconto permanente</span>
        )}
        <span className="familia-cartao-acao">
          {p?.membro ? 'Ver carteirinha' : 'Ver regras'}{' '}
          <span className="seta" aria-hidden>
            ›
          </span>
        </span>
      </span>
    </button>
  )
}

function Prazo({ titulo, ate, texto }: { titulo: string; ate: string; texto: string }) {
  const d = diasAte(ate)
  return (
    <li className={`familia-prazo ${d <= 7 ? 'perto' : ''}`}>
      <span className="familia-prazo-dias">
        <strong>{d}</strong>
        <span>{d === 1 ? 'dia' : 'dias'}</span>
      </span>
      <span className="familia-prazo-corpo">
        <span className="familia-prazo-titulo">{titulo}</span>
        <span className="suave">
          Até {data(ate)}. {texto}
        </span>
      </span>
    </li>
  )
}

export function FamiliaFolha({
  familia,
  agendar,
  convidar,
  fechar,
}: {
  familia: MinhaFamilia | null | undefined
  agendar: () => void
  convidar: () => void
  fechar: () => void
}) {
  const p = familia?.participando ? familia : null

  return (
    <Folha titulo="Lady Family" aoFechar={fechar}>
      <div className="indique familia">
        <header className="indique-topo">
          <span className="indique-brilho familia-brilho" aria-hidden />
          <Mascote humor="festa" size={100} />
          <span className="familia-rotulo">Programa</span>
          <h2>Lady Family</h2>
          <p>A família da Leide: {DESCONTO_FAMILIA}% de desconto para sempre em todos os serviços.</p>
        </header>

        {familia === undefined && <p className="aviso-erro">O programa ainda está sendo preparado. Volte daqui a pouco.</p>}
        {familia === null && <p className="suave indique-centro">Carregando…</p>}

        {familia?.participando === false && (
          <div className="indique-caixa indique-centro">
            <p>Seu progresso aparece aqui depois do seu primeiro agendamento pelo app. Ele fica ligado ao seu telefone.</p>
            <button className="botao" onClick={() => depoisDeFechar(agendar)}>
              Agendar horário
            </button>
          </div>
        )}

        {p?.membro && (
          <>
            <section className="familia-carteirinha" aria-label="Carteirinha da Lady Family">
              <span className="familia-carteirinha-topo">
                <span className="familia-rotulo">Lady Family</span>
                <span className="familia-selo" aria-hidden>
                  {DESCONTO_FAMILIA}%
                </span>
              </span>
              <strong className="familia-carteirinha-nome">{p.nome ?? 'Cliente'}</strong>
              <span>Da família da Leide desde {p.desde ? data(p.desde) : 'hoje'}</span>
              <span className="familia-carteirinha-pe">{DESCONTO_FAMILIA}% de desconto em todos os serviços</span>
            </section>
            <p className="suave indique-centro">Mostre esta tela para a Leide na hora de pagar.</p>
            <section className="indique-caixa">
              <Progresso pct={100} />
            </section>

            <section>
              <h3 className="indique-subtitulo">Para continuar na família</h3>
              <ul className="familia-prazos">
                {p.servico_ate && (
                  <Prazo titulo="Fazer 1 serviço" ate={p.servico_ate} texto="Qualquer serviço do salão vale." />
                )}
                {p.indicacao_ate && (
                  <Prazo titulo="Indicar 1 amiga nova" ate={p.indicacao_ate} texto="Ela precisa agendar pelo seu link." />
                )}
              </ul>
              <div className="indique-botoes">
                <button className="botao" onClick={() => depoisDeFechar(agendar)}>
                  Agendar horário
                </button>
                <button className="botao secundario" onClick={() => depoisDeFechar(convidar)}>
                  Pegar meu link de convite
                </button>
              </div>
            </section>
          </>
        )}

        {p && !p.membro && p.saiu_em && (
          <section className="indique-caixa">
            <p>
              Você saiu da família em {data(p.saiu_em)} porque passou um prazo. Para voltar, basta fazer o que falta abaixo:
            </p>
            <ul className="familia-volta">
              <li className={p.volta_servico ? 'familia-volta-ok' : ''}>{p.volta_servico ? '✓' : '○'} Fazer 1 serviço</li>
              <li className={p.volta_indicacao ? 'familia-volta-ok' : ''}>{p.volta_indicacao ? '✓' : '○'} Indicar 1 amiga nova</li>
            </ul>
          </section>
        )}

        {p && !p.membro && !p.saiu_em && (
          <section className="indique-caixa">
            <span className="indique-subtitulo">Seu caminho até a família</span>
            <Progresso pct={porcentagem(p)} />
            <div className="indique-botoes familia-botoes">
              <button className="botao" onClick={() => depoisDeFechar(agendar)}>
                Agendar horário
              </button>
              <button className="botao secundario" onClick={() => depoisDeFechar(convidar)}>
                Indicar uma amiga
              </button>
            </div>
          </section>
        )}

        <section>
          <h3 className="indique-subtitulo">Como funciona</h3>
          <ol className="indique-passos">
            <li>
              <strong>Para entrar:</strong> indique {AMIGAS_PARA_ENTRAR} amigas pelo seu link e faça {SERVICOS_PARA_ENTRAR} serviços
              quaisquer no salão.
            </li>
            <li>
              <strong>O presente:</strong> {DESCONTO_FAMILIA}% de desconto permanente em todos os serviços.
            </li>
            <li>
              <strong>Para se manter na família:</strong> faça 1 serviço por mês e indique 1 amiga nova a cada 3 meses.
            </li>
          </ol>
        </section>

        <section className="familia-cupons">
          <h3 className="indique-subtitulo">E os outros cupons?</h3>
          <p>
            Valem também! Primeiro entra o desconto da família e o cupom vale sobre o preço <strong>já descontado</strong>.
          </p>
          <div className="familia-conta" aria-label="Exemplo com um serviço de 100 reais">
            <span>
              Serviço <strong>R$ 100</strong>
            </span>
            <span aria-hidden>›</span>
            <span>
              Família −{DESCONTO_FAMILIA}% <strong>R$ 90</strong>
            </span>
            <span aria-hidden>›</span>
            <span>
              Cupom −30% <strong>R$ 63</strong>
            </span>
          </div>
        </section>

        <p className="suave">
          Contam os serviços feitos no salão e as amigas que agendaram pelo seu link e não cancelaram (as mesmas do Indique amigas).
          Os prazos contam a partir da entrada ou do último serviço e da última indicação. Se passar um prazo, você sai da família,
          mas volta fazendo 1 serviço e indicando 1 amiga nova.
        </p>
      </div>
    </Folha>
  )
}
