// Área Serviços: cada categoria tem uma peça fotografada em estúdio que gira em 360° com o arrasto.
// No computador a área fica presa na tela e a rolagem passa pelos três capítulos, como cenas de um filme.
// Não usa 3D no navegador: são fotos renderizadas, leves para qualquer celular.
import { useEffect, useRef, useState } from 'react'
import { scrollToY } from './cinema'
import type { Service } from './supabase'
import { ESMALTES, PECAS_CABELO, VitrineOuro, type Aba, type PecaCabelo } from './Vitrine'
import { Letras } from './Letras'

type Grupo = { key: string; title: string; items: Service[] }

const ABAS: { key: Aba; titulo: string; frase: string; rotulo: string }[] = [
  {
    key: 'cabelo',
    titulo: 'Cabelo',
    frase: 'Corte, escova, cor e tratamento, do jeito que você pedir.',
    rotulo: '',
  },
  {
    key: 'unhas',
    titulo: 'Unhas',
    frase: 'Manicure e pedicure com a cor que combina com você.',
    rotulo: 'Frasco de esmalte de vidro com tampa preta e aro dourado',
  },
  {
    key: 'estetica',
    titulo: 'Estética',
    frase: 'Sobrancelhas, depilação e cuidados com a pele.',
    rotulo: 'A musa do salão: cabeça de mulher em ouro polido sobre base de mármore preto',
  },
]

// Capítulos com a rolagem só no computador e para quem não pediu menos movimento
const CAPITULOS = '(min-width: 900px) and (prefers-reduced-motion: no-preference)'

export function Servicos({
  grupos,
  preco,
  duracao,
  escolher,
}: {
  grupos: Grupo[]
  preco: (s: Service) => string
  duracao: (s: Service) => string
  escolher: (s: Service) => void
}) {
  const [aba, setAba] = useState<Aba>('cabelo')
  const [cor, setCor] = useState(ESMALTES[0].cor)
  const [peca, setPeca] = useState<PecaCabelo>('secador')
  const secaoRef = useRef<HTMLElement>(null)
  const abaRef = useRef(aba)

  function trocar(nova: Aba) {
    if (nova === abaRef.current) return
    abaRef.current = nova
    setAba(nova)
  }

  // No computador, a posição da rolagem dentro da área escolhe o capítulo
  useEffect(() => {
    const mq = window.matchMedia(CAPITULOS)
    const ver = () => {
      const el = secaoRef.current
      if (!el || !mq.matches) return
      const r = el.getBoundingClientRect()
      const total = r.height - window.innerHeight
      if (total <= 0) return
      const p = Math.min(Math.max(-r.top / total, 0), 0.9999)
      trocar(ABAS[Math.floor(p * ABAS.length)].key)
    }
    window.addEventListener('scroll', ver, { passive: true })
    return () => window.removeEventListener('scroll', ver)
  }, [])

  function escolherAba(nova: Aba) {
    const el = secaoRef.current
    if (el && window.matchMedia(CAPITULOS).matches) {
      // Rola até o meio do capítulo; a troca acontece pela rolagem
      const i = ABAS.findIndex((a) => a.key === nova)
      const r = el.getBoundingClientRect()
      const total = r.height - window.innerHeight
      scrollToY(window.scrollY + r.top + ((i + 0.5) / ABAS.length) * total)
    } else trocar(nova)
  }

  const atual = ABAS.find((a) => a.key === aba)!
  const rotulo = aba === 'cabelo' ? PECAS_CABELO.find((p) => p.key === peca)!.rotulo : atual.rotulo
  const lista = grupos.find((g) => g.key === aba)?.items ?? []

  return (
    <section className="servicos" id="servicos" aria-labelledby="servicos-titulo" data-aba={aba} ref={secaoRef}>
      <div className="servicos-cena">
        <div className="palco">
          <VitrineOuro aba={aba} cor={cor} peca={peca} rotulo={rotulo} />
        </div>

        <div className="servicos-texto">
          <h2 id="servicos-titulo" className="surge" aria-label="Serviços">
            <span className="linha" aria-hidden>
              <Letras texto="Serviços" />
            </span>
          </h2>
          <div className="abas" role="tablist" aria-label="Categorias">
            {ABAS.map((a) => (
              <button
                key={a.key}
                role="tab"
                id={`aba-${a.key}`}
                aria-selected={aba === a.key}
                aria-controls="servicos-painel"
                className={`aba ${aba === a.key ? 'ativa' : ''}`}
                onClick={() => escolherAba(a.key)}
              >
                {a.titulo}
              </button>
            ))}
          </div>

          <div id="servicos-painel" role="tabpanel" aria-labelledby={`aba-${aba}`} className="servicos-painel" key={aba}>
            <p className="servicos-frase">{atual.frase}</p>

            {aba === 'cabelo' && (
              <div className="controles" role="radiogroup" aria-label="Peça">
                {PECAS_CABELO.map((p) => (
                  <button
                    key={p.key}
                    role="radio"
                    aria-checked={peca === p.key}
                    className="controle"
                    onClick={() => setPeca(p.key)}
                  >
                    {p.nome}
                  </button>
                ))}
              </div>
            )}

            {aba === 'unhas' && (
              <div className="controles">
                <div className="esmaltes" role="radiogroup" aria-label="Cor do esmalte">
                  {ESMALTES.map((e) => (
                    <button
                      key={e.nome}
                      role="radio"
                      aria-checked={cor === e.cor}
                      className="esmalte"
                      style={{ background: e.cor }}
                      title={e.nome}
                      onClick={() => setCor(e.cor)}
                    >
                      <span className="sr">{e.nome}</span>
                    </button>
                  ))}
                  <span className="esmalte-nome">{ESMALTES.find((e) => e.cor === cor)?.nome}</span>
                </div>
              </div>
            )}

            <ul className="servicos-lista">
              {lista.map((s) => (
                <li key={s.id}>
                  <button className="servico-linha" onClick={() => escolher(s)} data-cursor="Agendar">
                    <span className="servico-nome">{s.name}</span>
                    {s.duration_min > 0 && (
                      <span className="servico-info">
                        {duracao(s)} · {preco(s)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
