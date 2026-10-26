import { useState } from 'react'
import { WhatsAppIcon } from '../../icons'
import { linkConvite, POR_PREMIO, validadeFmt, type CupomConvite, type MeuConvite } from '../convite'
import { CompartilharIcon, CopiarIcon, PresenteIcon } from '../icones'
import { Mascote } from '../Mascote'
import { depoisDeFechar, Folha } from '../ui'

// Quantas amigas já contam para o próximo cupom de 30% (0, 1 ou 2)
function naRodada(meu: MeuConvite | null | undefined) {
  return meu?.participando ? meu.validas % POR_PREMIO : 0
}

function Bolinhas({ cheias, nomes = [] }: { cheias: number; nomes?: string[] }) {
  return (
    <span className="indique-bolinhas" aria-label={`${cheias} de ${POR_PREMIO} amigas`}>
      {Array.from({ length: POR_PREMIO }, (_, i) => (
        <span key={i} className={`indique-bolinha ${i < cheias ? 'cheia' : ''}`} aria-hidden>
          {i < cheias ? (nomes[i]?.[0]?.toUpperCase() ?? '✓') : i + 1}
        </span>
      ))}
      <span className="indique-bolinha premio" aria-hidden>
        30%
      </span>
    </span>
  )
}

// Cartão de destaque no topo da aba Eventos
export function IndiqueCartao({ meu, abrir }: { meu: MeuConvite | null | undefined; abrir: () => void }) {
  const n = naRodada(meu)
  return (
    <button className="cartao indique-cartao" onClick={abrir}>
      <span className="indique-cartao-topo">
        <span>
          <span className="indique-rotulo">Campanha</span>
          <span className="indique-nome">Indique amigas</span>
        </span>
        <Mascote humor="festa" mini size={56} />
      </span>
      <span className="indique-cartao-texto">
        A cada <strong>3 amigas novas</strong>, você ganha <strong>30% de desconto</strong>. E elas ganham 10% no primeiro
        horário.
      </span>
      <span className="indique-cartao-pe">
        <Bolinhas cheias={n} />
        <span className="indique-cartao-acao">
          Pegar meu link{' '}
          <span className="seta" aria-hidden>
            ›
          </span>
        </span>
      </span>
    </button>
  )
}

function Cupom({ c }: { c: CupomConvite }) {
  const vencido = !c.usado_em && new Date(c.expira_em).getTime() < Date.now()
  const estado = c.usado_em ? 'usado' : vencido ? 'vencido' : 'valendo'
  return (
    <li className={`indique-ticket ${estado}`}>
      <span className="indique-ticket-valor">
        <strong>{c.desconto}%</strong>
        <span>off</span>
      </span>
      <span className="indique-ticket-corpo">
        <span className="indique-ticket-titulo">{c.tipo === 'madrinha' ? 'Prêmio por 3 amigas' : 'Presente de boas-vindas'}</span>
        <span className="indique-ticket-codigo">{c.codigo}</span>
        <span className="indique-ticket-pe">
          {c.usado_em ? 'Já usado' : vencido ? 'Venceu' : `Vale até ${validadeFmt.format(new Date(c.expira_em)).replace('.', '')}`}
        </span>
      </span>
    </li>
  )
}

const SITUACAO = { agendou: 'Agendou', veio: 'Já veio', cancelou: 'Cancelou' }

export function IndiqueFolha({ meu, agendar, fechar }: { meu: MeuConvite | null | undefined; agendar: () => void; fechar: () => void }) {
  const [copiado, setCopiado] = useState(false)
  const participa = meu?.participando === true
  const link = participa ? linkConvite(meu.codigo) : ''
  const n = naRodada(meu)
  const texto = participa
    ? `Oi! Vem conhecer o Leide Hair 💛 Agendando pelo meu link você ganha 10% de desconto no seu primeiro horário: ${link}`
    : ''

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      // Celulares antigos: copia pelo jeito antigo
      const campo = document.createElement('textarea')
      campo.value = link
      document.body.append(campo)
      campo.select()
      document.execCommand('copy')
      campo.remove()
    }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2200)
  }

  const podeCompartilhar = typeof navigator.share === 'function'

  return (
    <Folha titulo="Indique amigas" aoFechar={fechar}>
      <div className="indique">
        <header className="indique-topo">
          <span className="indique-brilho" aria-hidden />
          <Mascote humor="festa" size={100} />
          <span className="indique-rotulo">Campanha</span>
          <h2>Indique amigas</h2>
          <p>Traga suas amigas para o Leide Hair e ganhe desconto junto com elas.</p>
        </header>

        <div className="indique-premios">
          <div className="indique-premio voce">
            <strong>30%</strong>
            <span>para você a cada 3 amigas novas</span>
          </div>
          <div className="indique-premio ela">
            <strong>10%</strong>
            <span>para ela no primeiro horário</span>
          </div>
        </div>

        {meu === undefined && <p className="aviso-erro">A campanha ainda está sendo preparada. Volte daqui a pouco.</p>}
        {meu === null && <p className="suave indique-centro">Carregando seu convite…</p>}

        {meu?.participando === false && (
          <div className="indique-caixa indique-centro">
            <p>
              Seu link de convite aparece aqui depois do seu primeiro agendamento pelo app. Ele fica ligado ao seu telefone.
            </p>
            <button className="botao" onClick={() => depoisDeFechar(agendar)}>
              Agendar horário
            </button>
          </div>
        )}

        {participa && (
          <>
            <section className="indique-caixa">
              <div className="indique-progresso-topo">
                <span className="indique-subtitulo">Rumo aos 30%</span>
                <span className="suave">
                  {n}/{POR_PREMIO}
                </span>
              </div>
              <Bolinhas
                cheias={n}
                nomes={meu.amigas
                  .filter((a) => a.situacao !== 'cancelou')
                  .slice(0, n)
                  .reverse()
                  .map((a) => a.nome)}
              />
              <p className="suave indique-centro">
                {n === 0 && meu.validas === 0
                  ? 'Mande seu link para 3 amigas que ainda não conhecem o salão.'
                  : n === 0
                    ? 'Cupom liberado! Mande para mais 3 amigas e ganhe outro.'
                    : `Falta${POR_PREMIO - n > 1 ? 'm' : ''} ${POR_PREMIO - n} amiga${POR_PREMIO - n > 1 ? 's' : ''} para o seu cupom de 30%.`}
              </p>
            </section>

            <section className="indique-link">
              <span className="indique-subtitulo">Seu link de convite</span>
              <button className="indique-link-campo" onClick={copiar} aria-label="Copiar link de convite">
                <span className="indique-link-texto">{link.replace(/^https?:\/\//, '')}</span>
                <span className={`indique-copiar ${copiado ? 'ok' : ''}`}>
                  {copiado ? '✓ Copiado' : (
                    <>
                      <CopiarIcon /> Copiar
                    </>
                  )}
                </span>
              </button>
              <div className="indique-botoes">
                <a className="botao" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer">
                  <WhatsAppIcon /> Enviar no WhatsApp
                </a>
                {podeCompartilhar && (
                  <button
                    className="botao secundario"
                    onClick={() => navigator.share({ title: 'Leide Hair', text: texto }).catch(() => {})}
                  >
                    <CompartilharIcon /> Outros apps
                  </button>
                )}
              </div>
              <p className="suave indique-centro" role="status">
                {copiado ? 'Link copiado! Agora é só colar na conversa.' : 'Copie e cole no Instagram, no grupo da família…'}
              </p>
            </section>

            {meu.cupons.length > 0 && (
              <section>
                <h3 className="indique-subtitulo">Seus cupons</h3>
                <ul className="indique-tickets">
                  {meu.cupons.map((c) => (
                    <Cupom key={c.codigo} c={c} />
                  ))}
                </ul>
                <p className="suave">Mostre o código para a Leide no dia do seu horário.</p>
              </section>
            )}

            <section>
              <h3 className="indique-subtitulo">Suas amigas</h3>
              {meu.amigas.length === 0 ? (
                <p className="suave">Nenhuma amiga agendou pelo seu link ainda.</p>
              ) : (
                <ul className="indique-amigas">
                  {meu.amigas.map((a, i) => (
                    <li key={i}>
                      <span className="indique-avatar" aria-hidden>
                        {a.nome[0]?.toUpperCase()}
                      </span>
                      <span className="indique-amiga-nome">{a.nome}</span>
                      <span className={`selo ${a.situacao === 'veio' ? 'concluido' : a.situacao === 'cancelou' ? 'cancelado' : ''}`}>
                        {SITUACAO[a.situacao]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        <section>
          <h3 className="indique-subtitulo">Como funciona</h3>
          <ol className="indique-passos">
            <li>
              <strong>Mande seu link</strong> para amigas que nunca foram ao salão.
            </li>
            <li>
              <strong>Ela agenda pelo link</strong> e ganha 10% de desconto no primeiro horário.
            </li>
            <li>
              <strong>A cada 3 amigas novas</strong>, aparece aqui um cupom de 30% para você.
            </li>
          </ol>
          <p className="suave">Só contam amigas que nunca agendaram no salão. Se ela cancelar, a indicação deixa de contar.</p>
        </section>
      </div>
    </Folha>
  )
}

// A amiga abriu o link de convite
export function BoasVindasFolha({ madrinha, agendar, fechar }: { madrinha: string | null; agendar: () => void; fechar: () => void }) {
  return (
    <Folha titulo="Você foi convidada" aoFechar={fechar}>
      <div className="detalhe-servico indique-presente">
        <Mascote humor="oi" size={108} />
        <span className="indique-rotulo">Você foi convidada</span>
        <h2>{madrinha ? `${madrinha} te deu 10% de desconto` : 'Você ganhou 10% de desconto'}</h2>
        <p>Agende seu primeiro horário pelo app e o cupom de 10% é seu. Seja bem-vinda ao Leide Hair!</p>
        <p className="suave">Vale para quem ainda não foi atendida no salão.</p>
        <button className="botao" onClick={() => depoisDeFechar(agendar)}>
          Agendar meu horário
        </button>
        <button className="botao texto" onClick={() => history.back()}>
          Conhecer o app primeiro
        </button>
      </div>
    </Folha>
  )
}

// Agendou pelo convite: mostra o cupom de 10%
export function PresenteFolha({
  cupom,
  madrinha,
  convidar,
  fechar,
}: {
  cupom: CupomConvite
  madrinha: string | null
  convidar: () => void
  fechar: () => void
}) {
  return (
    <Folha titulo="Seu presente" aoFechar={fechar}>
      <div className="detalhe-servico indique-presente">
        <Mascote humor="festa" size={108} />
        <h2>Seu presente chegou!</h2>
        <p>{madrinha ? `Graças ao convite da ${madrinha}, você` : 'Você'} ganhou 10% de desconto no seu primeiro horário.</p>
        <div className="cupom">
          <span className="cupom-rotulo">
            <PresenteIcon /> {cupom.desconto}% de desconto
          </span>
          <span className="cupom-codigo">{cupom.codigo}</span>
          <span className="cupom-tempo">Vale até {validadeFmt.format(new Date(cupom.expira_em)).replace('.', '')}</span>
        </div>
        <p className="suave">Mostre este código para a Leide no dia do seu horário. Ele também fica guardado em Eventos.</p>
        <button className="botao secundario" onClick={() => depoisDeFechar(convidar)}>
          Quero convidar minhas amigas
        </button>
      </div>
    </Folha>
  )
}
