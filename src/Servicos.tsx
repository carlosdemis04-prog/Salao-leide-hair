// Área Serviços: cada categoria tem uma peça 3D num estúdio escuro, que dá para girar e tocar.
// No computador a área fica presa na tela e a rolagem passa pelos três capítulos, como cenas de um filme.
// O three.js só é baixado quando a área chega perto da tela, e o desenho pausa quando ela sai.
import { useEffect, useRef, useState } from 'react'
import { scrollToY } from './cinema'
import type { Service } from './supabase'
import type { Aba, Vitrine } from './tres/cenas'
import { ACABAMENTOS, ESMALTES } from './tres/dados'
import { Letras } from './Letras'

type Grupo = { key: string; title: string; items: Service[] }

const ABAS: { key: Aba; titulo: string; frase: string; dica: string }[] = [
  {
    key: 'cabelo',
    titulo: 'Cabelo',
    frase: 'Corte, escova, cor e tratamento, do jeito que você pedir.',
    dica: 'Toque no secador para ligar e na tesoura para cortar. Arraste para girar.',
  },
  {
    key: 'unhas',
    titulo: 'Unhas',
    frase: 'Manicure e pedicure com a cor que combina com você.',
    dica: 'Escolha a cor e passe o dedo em cima de uma unha para pintar.',
  },
  {
    key: 'estetica',
    titulo: 'Estética',
    frase: 'Sobrancelhas, depilação e cuidados com a pele.',
    dica: 'Toque no troféu ou escolha o acabamento do ouro. Arraste para girar.',
  },
]

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`

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
  const [ligado, setLigado] = useState(false)
  const [cor, setCor] = useState(ESMALTES[0].cor)
  const [acabamento, setAcabamento] = useState(0)
  const [semWebGL, setSemWebGL] = useState(false)
  const [pronto, setPronto] = useState(false)
  const secaoRef = useRef<HTMLElement>(null)
  const palcoRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const vitrine = useRef<Vitrine | null>(null)
  const abaRef = useRef(aba)
  useEffect(() => {
    abaRef.current = aba
  }, [aba])

  // Carrega as peças quando a área está a uma tela de distância; pausa fora da tela
  useEffect(() => {
    const el = palcoRef.current!
    let cancelado = false
    let visivel = false
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const carregar = async () => {
      const m = await import('./tres/cenas')
      if (cancelado) return
      if (!m.temWebGL()) {
        setSemWebGL(true)
        return
      }
      const v = m.montarVitrine(canvasRef.current!, reduzido, { secador: setLigado, acabamento: setAcabamento })
      vitrine.current = v
      v.mostrar(abaRef.current)
      v.palco.deslocar(window.matchMedia(CAPITULOS).matches ? 0.17 : 0)
      v.palco.pausar(!visivel)
      setPronto(true)
    }
    const perto = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          perto.disconnect()
          carregar()
        }
      },
      { rootMargin: '100% 0px' },
    )
    const tela = new IntersectionObserver(([e]) => {
      visivel = e.isIntersecting
      vitrine.current?.palco.pausar(!visivel)
    })
    perto.observe(el)
    tela.observe(el)
    return () => {
      cancelado = true
      perto.disconnect()
      tela.disconnect()
      vitrine.current?.palco.descartar()
      vitrine.current = null
    }
  }, [])

  function trocar(nova: Aba) {
    if (nova === abaRef.current) return
    abaRef.current = nova
    setAba(nova)
    setLigado(false)
    setAcabamento(0)
    setCor(ESMALTES[0].cor)
    vitrine.current?.mostrar(nova)
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
    const mudouTela = () => vitrine.current?.palco.deslocar(mq.matches ? 0.17 : 0)
    window.addEventListener('scroll', ver, { passive: true })
    mq.addEventListener('change', mudouTela)
    return () => {
      window.removeEventListener('scroll', ver)
      mq.removeEventListener('change', mudouTela)
    }
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
  const lista = grupos.find((g) => g.key === aba)?.items ?? []

  return (
    <section className="servicos" id="servicos" aria-labelledby="servicos-titulo" data-aba={aba} ref={secaoRef}>
      <div className="servicos-cena">
        <div className={`palco ${pronto ? 'pronto' : ''}`} ref={palcoRef}>
          {semWebGL ? (
            <img className="palco-figura" src="/figura.webp" alt="" width="698" height="409" />
          ) : (
            <canvas
              ref={canvasRef}
              className="palco-canvas"
              role="img"
              aria-label={
                aba === 'cabelo'
                  ? 'Secador profissional e tesoura de corte em 3D, num estúdio escuro'
                  : aba === 'unhas'
                    ? 'Frascos de esmalte e unhas postiças sendo pintadas, em 3D'
                    : 'Troféu de cristal com a figura da logo em ouro, em 3D'
              }
            />
          )}
          {!semWebGL && <p className="palco-dica">{atual.dica}</p>}
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

            {!semWebGL && (
              <div className="controles">
                {aba === 'cabelo' && (
                  <>
                    <button className="controle" aria-pressed={ligado} onClick={() => vitrine.current?.ligarSecador()}>
                      {ligado ? 'Desligar o secador' : 'Ligar o secador'}
                    </button>
                    <button className="controle" onClick={() => vitrine.current?.cortar()}>
                      Dar um corte
                    </button>
                  </>
                )}
                {aba === 'unhas' && (
                  <div className="esmaltes" role="radiogroup" aria-label="Cor do esmalte">
                    {ESMALTES.map((e) => (
                      <button
                        key={e.nome}
                        role="radio"
                        aria-checked={cor === e.cor}
                        className="esmalte"
                        style={{ background: hex(e.cor) }}
                        title={e.nome}
                        onClick={() => {
                          setCor(e.cor)
                          vitrine.current?.mudarCor(e.cor)
                        }}
                      >
                        <span className="sr">{e.nome}</span>
                      </button>
                    ))}
                    <span className="esmalte-nome">{ESMALTES.find((e) => e.cor === cor)?.nome}</span>
                  </div>
                )}
                {aba === 'estetica' && (
                  <div className="poses" role="radiogroup" aria-label="Acabamento do ouro">
                    {ACABAMENTOS.map((a, i) => (
                      <button
                        key={a.nome}
                        role="radio"
                        aria-checked={acabamento === i}
                        className="controle"
                        onClick={() => vitrine.current?.mudarAcabamento(i)}
                      >
                        {a.nome}
                      </button>
                    ))}
                  </div>
                )}
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
