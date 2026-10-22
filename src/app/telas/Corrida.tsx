import { useState } from 'react'
import { useFaltam, pontosFmt, type Corrida, type Meta } from '../lady'
import { Mascote } from '../Mascote'
import { depoisDeFechar, Folha } from '../ui'

function proximaMeta(c: Corrida) {
  return c.metas.find((m) => m.pontos > c.pontos) ?? null
}

// Quanto da barra já andou até a próxima meta (0 a 100)
function progresso(c: Corrida) {
  const prox = proximaMeta(c)
  if (!prox) return 100
  const antes = [...c.metas].reverse().find((m) => m.pontos <= c.pontos)?.pontos ?? 0
  return Math.round(((c.pontos - antes) / (prox.pontos - antes)) * 100)
}

// Cartão do topo da aba Ofertas
export function CorridaCartao({ corrida, abrir }: { corrida: Corrida | null; abrir: () => void }) {
  const prox = corrida && proximaMeta(corrida)
  const prontas = corrida?.metas.filter((m) => m.situacao === 'disponivel' || m.situacao === 'ativa').length ?? 0
  return (
    <button className="cartao corrida-cartao" onClick={abrir} disabled={!corrida}>
      <span className="corrida-cartao-topo">
        <span>
          <span className="corrida-rotulo">Corrida das</span>
          <span className="corrida-nome">Lady Points</span>
        </span>
        <Mascote humor="festa" mini size={52} />
      </span>
      {corrida ? (
        <>
          <span className="corrida-total">
            <strong>{pontosFmt.format(corrida.pontos)}</strong> pontos
          </span>
          <span className="corrida-barra" aria-hidden>
            <i style={{ width: `${progresso(corrida)}%` }} />
          </span>
          <span className="corrida-pe">
            {prontas > 0
              ? `${prontas === 1 ? '1 recompensa pronta' : `${prontas} recompensas prontas`} para resgatar`
              : prox
                ? `Faltam ${pontosFmt.format(prox.pontos - corrida.pontos)} para: ${prox.titulo}`
                : 'Você chegou ao fim da corrida!'}
            <span className="seta" aria-hidden>
              ›
            </span>
          </span>
        </>
      ) : (
        <span className="corrida-pe">Carregando seus pontos…</span>
      )}
    </button>
  )
}

type Resgate = { titulo: string; codigo: string; expira_em: string }

export function CorridaFolha({
  corrida,
  resgatar,
  atualizar,
  agendar,
  fechar,
}: {
  corrida: Corrida
  resgatar: (meta: string) => Promise<{ codigo: string; expira_em: string } | string>
  atualizar: () => void
  agendar: () => void
  fechar: () => void
}) {
  const [confirmar, setConfirmar] = useState<Meta | null>(null)
  const [codigo, setCodigo] = useState<Resgate | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function gerar(m: Meta) {
    setEnviando(true)
    setErro('')
    const r = await resgatar(m.id)
    setEnviando(false)
    if (typeof r === 'string') return setErro(r)
    setConfirmar(null)
    setCodigo({ titulo: m.titulo, ...r })
  }

  return (
    <Folha titulo="Corrida das Lady Points" aoFechar={fechar}>
      {codigo ? (
        <CodigoResgate resgate={codigo} voltar={() => (setCodigo(null), atualizar())} />
      ) : confirmar ? (
        <div className="detalhe-servico">
          <Mascote humor="oferta" size={96} />
          <h2>{confirmar.titulo}</h2>
          <p>
            Ao resgatar, aparece um código que vale por <strong>24 horas</strong>. Resgate quando estiver no salão ou no dia do
            seu horário, e mostre o código para a Leide.
          </p>
          {erro && <p className="aviso-erro">{erro}</p>}
          <button className="botao" onClick={() => gerar(confirmar)} disabled={enviando}>
            {enviando ? 'Gerando…' : 'Resgatar agora'}
          </button>
          <button className="botao texto" onClick={() => (setConfirmar(null), setErro(''))}>
            Agora não
          </button>
        </div>
      ) : (
        <div className="corrida">
          <header className="corrida-topo">
            <Mascote humor="festa" size={92} />
            <h2>Corrida das Lady Points</h2>
            <p className="corrida-total grande">
              <strong>{pontosFmt.format(corrida.pontos)}</strong> pontos
            </p>
            <p className="suave">A cada R$ 1,00 no salão você ganha 100 Lady Points. Bata as metas e resgate os prêmios!</p>
          </header>

          {!corrida.participando && (
            <div className="corrida-aviso">
              <p>Para entrar na corrida, agende um horário pelo app. Seus pontos ficam ligados ao seu telefone.</p>
              <button className="botao secundario" onClick={() => depoisDeFechar(agendar)}>
                Agendar horário
              </button>
            </div>
          )}

          <ol className="trilha">
            {corrida.metas.map((m) => (
              <li key={m.id} className={`meta ${m.situacao} ${m.final ? 'final' : ''}`}>
                <span className="meta-marco" aria-hidden>
                  {m.situacao === 'bloqueada' ? '' : '✓'}
                </span>
                <span className="meta-corpo">
                  <span className="meta-pontos">{pontosFmt.format(m.pontos)} pontos</span>
                  <span className="meta-titulo">{m.titulo}</span>
                  {m.descricao && <span className="meta-desc">{m.descricao}</span>}
                </span>
                <span className="meta-acao">
                  {m.situacao === 'disponivel' && (
                    <button className="botao mini" onClick={() => setConfirmar(m)}>
                      Resgatar
                    </button>
                  )}
                  {m.situacao === 'ativa' && m.codigo && m.expira_em && (
                    <button
                      className="botao mini ouro"
                      onClick={() => setCodigo({ titulo: m.titulo, codigo: m.codigo!, expira_em: m.expira_em! })}
                    >
                      Ver código
                    </button>
                  )}
                  {m.situacao === 'usada' && <span className="selo concluido">Usada</span>}
                  {m.situacao === 'bloqueada' && (
                    <span className="meta-falta">faltam {pontosFmt.format(m.pontos - corrida.pontos)}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
          <p className="suave corrida-nota">
            Os pontos entram quando a Leide registra o seu pagamento. Cada recompensa pode ser usada uma vez.
          </p>
        </div>
      )}
    </Folha>
  )
}

function CodigoResgate({ resgate, voltar }: { resgate: Resgate; voltar: () => void }) {
  const faltam = useFaltam(resgate.expira_em)
  const venceu = faltam?.acabou
  return (
    <div className="detalhe-servico">
      <Mascote humor={venceu ? 'vazio' : 'festa'} size={104} />
      <h2>{resgate.titulo}</h2>
      <div className={`cupom ${venceu ? 'vencido' : ''}`}>
        <span className="cupom-rotulo">Seu código</span>
        <span className="cupom-codigo" aria-label={resgate.codigo.split('').join(' ')}>
          {resgate.codigo}
        </span>
        <span className="cupom-tempo" role="timer">
          {venceu ? 'Código vencido' : `Vale por mais ${faltam?.texto}`}
        </span>
      </div>
      <p>
        {venceu
          ? 'Esse código venceu sem ser usado. Volte para a corrida e resgate de novo.'
          : 'Mostre este código para a Leide no salão. Ela valida na hora e aplica a sua recompensa.'}
      </p>
      <button className="botao secundario" onClick={voltar}>
        Voltar para a corrida
      </button>
    </div>
  )
}
