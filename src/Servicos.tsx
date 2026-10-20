// Área Serviços: cada categoria tem uma peça 3D que dá para girar e tocar, em cima do disco dourado da logo.
// O three.js só é baixado quando a área chega perto da tela, e o desenho pausa quando ela sai.
import { useEffect, useRef, useState } from 'react'
import type { Service } from './supabase'
import type { Aba, Vitrine } from './tres/cenas'
import { ESMALTES, POSES_NOMES } from './tres/dados'
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
    dica: 'Toque na modelo para ela mudar de pose. Arraste para girar.',
  },
]

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`

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
  const [pose, setPose] = useState(0)
  const [semWebGL, setSemWebGL] = useState(false)
  const [pronto, setPronto] = useState(false)
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
      const v = m.montarVitrine(canvasRef.current!, reduzido, { secador: setLigado, pose: setPose })
      vitrine.current = v
      v.mostrar(abaRef.current)
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
    if (nova === aba) return
    setAba(nova)
    setLigado(false)
    setPose(0)
    setCor(ESMALTES[0].cor)
    vitrine.current?.mostrar(nova)
  }

  const atual = ABAS.find((a) => a.key === aba)!
  const lista = grupos.find((g) => g.key === aba)?.items ?? []

  return (
    <section className="servicos" id="servicos" aria-labelledby="servicos-titulo" data-aba={aba}>
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
              onClick={() => trocar(a.key)}
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
                <div className="poses" role="radiogroup" aria-label="Pose da modelo">
                  {POSES_NOMES.map((n, i) => (
                    <button key={n} role="radio" aria-checked={pose === i} className="controle" onClick={() => vitrine.current?.mudarPose(i)}>
                      {n}
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

      <div className={`palco ${pronto ? 'pronto' : ''}`} ref={palcoRef}>
        <div className="palco-disco" aria-hidden />
        {semWebGL ? (
          <img className="palco-figura" src="/figura-escura.webp" alt="" width="698" height="409" />
        ) : (
          <canvas
            ref={canvasRef}
            className="palco-canvas"
            role="img"
            aria-label={
              aba === 'cabelo'
                ? 'Secador e tesoura dourados em 3D'
                : aba === 'unhas'
                  ? 'Mão com as unhas sendo pintadas de esmalte, em 3D'
                  : 'Estatueta dourada de uma modelo com o cabelo ao vento, em 3D'
            }
          />
        )}
        {!semWebGL && <p className="palco-dica">{atual.dica}</p>}
      </div>
    </section>
  )
}
