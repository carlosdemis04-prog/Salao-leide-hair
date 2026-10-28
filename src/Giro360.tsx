// Peça que gira em 360°: uma sequência de fotos renderizadas em estúdio, uma a cada poucos graus.
// Arrastar para os lados gira a peça. As fotos são próximas o bastante (5 a 7,5 graus) para o giro parecer contínuo,
// e nunca se misturam duas fotos, para não aparecer imagem dupla.
// Não usa 3D no navegador: são só imagens num canvas, leve até em celular simples.
import { useEffect, useRef, useState } from 'react'

export type Sequencia = { pasta: string; quadros: number }

const REDUZIDO = '(prefers-reduced-motion: reduce)'
// Uma largura inteira de arrasto dá uma volta completa
const VOLTA_POR_LARGURA = 1

const quadro = (s: Sequencia, i: number) => `${s.pasta}/${String(i).padStart(2, '0')}.webp`

function economia() {
  return !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
}

export function Giro360({
  seq,
  rotulo,
  aproximar = false,
}: {
  seq: Sequencia
  rotulo: string
  aproximar?: boolean
}) {
  const caixaRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [carregado, setCarregado] = useState(0)
  const [perto, setPerto] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [dica, setDica] = useState(true)
  // Estado do giro fora do React: muda a cada quadro de animação
  const entrou = useRef('')
  const redesenhar = useRef(() => {})
  const giro = useRef({ pos: 0, vel: 0, arrastando: false, ultimoX: 0, ultimoT: 0, imgs: [] as HTMLImageElement[] })

  // Começa a baixar só quando a vitrine chega perto da tela
  useEffect(() => {
    const el = caixaRef.current!
    const obs = new IntersectionObserver(([e]) => e.isIntersecting && setPerto(true), { rootMargin: '400px 0px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Cada sequência monta um Giro360 novo (key no pai), então as fotos nunca se misturam.
  // Baixa as fotos: a primeira na hora, as outras em seguida (com economia de dados, só depois de tocar)
  useEffect(() => {
    const g = giro.current
    if (!perto) return
    let cancelado = false
    let prontas = 0
    const baixar = (i: number) => {
      const img = new Image()
      img.decoding = 'async'
      img.src = quadro(seq, i)
      img
        .decode()
        .catch(() => {})
        .then(() => {
          if (cancelado || !img.naturalWidth) return
          g.imgs[i] = img
          prontas++
          setCarregado(prontas)
        })
    }
    baixar(0)
    const resto = () => {
      for (let i = 1; i < seq.quadros; i++) baixar(i)
    }
    let soltar = () => {}
    if (economia()) {
      const el = caixaRef.current!
      const uma = () => resto()
      el.addEventListener('pointerdown', uma, { once: true })
      soltar = () => el.removeEventListener('pointerdown', uma)
    } else resto()
    return () => {
      cancelado = true
      soltar()
    }
  }, [perto, seq])

  // Uma foto que chegou agora pode ser exatamente a do ângulo parado na tela
  useEffect(() => redesenhar.current(), [carregado])

  const temFoto = carregado > 0
  const pronto = carregado >= seq.quadros

  // Desenho e movimento
  useEffect(() => {
    const canvas = canvasRef.current!
    const caixa = caixaRef.current!
    const ctx = canvas.getContext('2d')!
    const g = giro.current
    const reduzido = window.matchMedia(REDUZIDO).matches
    let visivel = false
    let raf = 0
    let antes = performance.now()
    let desenhado: HTMLImageElement | null = null

    const medir = () => {
      const r = canvas.getBoundingClientRect()
      const escala = Math.min(window.devicePixelRatio || 1, 2) * (zoom ? 1.8 : 1)
      const w = Math.round(r.width * escala)
      if (canvas.width !== w) {
        canvas.width = w
        canvas.height = w
        desenhado = null
      }
    }

    // Foto mais próxima que já chegou, para nunca mostrar um buraco enquanto baixa
    const pegar = (i: number) => {
      const n = seq.quadros
      for (let d = 0; d < n; d++) {
        const a = g.imgs[(i + d) % n] ?? g.imgs[(i - d + n) % n]
        if (a) return a
      }
      return null
    }

    const desenhar = () => {
      const n = seq.quadros
      const i = Math.round((((g.pos % 1) + 1) % 1) * n) % n
      const a = pegar(i)
      if (!a || a === desenhado) return
      desenhado = a
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(a, 0, 0, canvas.width, canvas.height)
    }

    const passo = (t: number) => {
      raf = 0
      const dt = Math.min((t - antes) / 1000, 0.05)
      antes = t
      let mexendo = g.arrastando
      if (!g.arrastando && Math.abs(g.vel) > 0.002) {
        // Inércia depois de soltar, perdendo força aos poucos
        g.pos += g.vel * dt
        g.vel *= Math.pow(0.04, dt)
        mexendo = true
      }
      desenhar()
      // Parada, a peça não gasta nada: o laço só volta com um toque, seta ou entrada
      if (visivel && mexendo) raf = requestAnimationFrame(passo)
    }

    const ligar = () => {
      if (!raf && visivel) {
        antes = performance.now()
        raf = requestAnimationFrame(passo)
      }
    }

    const tela = new IntersectionObserver(([e]) => {
      visivel = e.isIntersecting
      if (visivel) ligar()
    })
    tela.observe(canvas)

    const tamanho = new ResizeObserver(() => {
      medir()
      desenhar()
    })
    tamanho.observe(canvas)

    // Entrada: quando a primeira foto chega, a peça entra girando um quarto de volta e assenta de frente
    if (g.imgs[0] && entrou.current !== seq.pasta) {
      entrou.current = seq.pasta
      g.pos = reduzido ? 0 : -0.22
      g.vel = reduzido ? 0 : 0.62
    }

    const baixo = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      g.arrastando = true
      g.vel = 0
      g.ultimoX = e.clientX
      g.ultimoT = performance.now()
      caixa.setPointerCapture(e.pointerId)
      caixa.classList.add('arrastando')
      setDica(false)
      ligar()
    }
    const mover = (e: PointerEvent) => {
      if (!g.arrastando) return
      const agora = performance.now()
      const dx = e.clientX - g.ultimoX
      const largura = caixa.getBoundingClientRect().width || 1
      // Arrastar para a direita leva a frente da peça para a direita (as fotos giram no sentido anti-horário)
      const d = (dx / largura) * VOLTA_POR_LARGURA
      g.pos += d
      const dt = Math.max((agora - g.ultimoT) / 1000, 0.008)
      g.vel = g.vel * 0.6 + (d / dt) * 0.4
      g.ultimoX = e.clientX
      g.ultimoT = agora
    }
    const solto = () => {
      if (!g.arrastando) return
      g.arrastando = false
      g.vel = Math.max(Math.min(g.vel, 2.5), -2.5)
      caixa.classList.remove('arrastando')
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      g.pos += (e.key === 'ArrowRight' ? 1 : -1) / seq.quadros
      g.vel = 0
      setDica(false)
      ligar()
    }

    caixa.addEventListener('pointerdown', baixo)
    caixa.addEventListener('pointermove', mover)
    caixa.addEventListener('pointerup', solto)
    caixa.addEventListener('pointercancel', solto)
    caixa.addEventListener('keydown', tecla)
    redesenhar.current = desenhar
    medir()
    desenhar()
    return () => {
      cancelAnimationFrame(raf)
      tela.disconnect()
      tamanho.disconnect()
      caixa.removeEventListener('pointerdown', baixo)
      caixa.removeEventListener('pointermove', mover)
      caixa.removeEventListener('pointerup', solto)
      caixa.removeEventListener('pointercancel', solto)
      caixa.removeEventListener('keydown', tecla)
    }
  }, [seq, zoom, temFoto])


  return (
    <div className={`giro ${zoom ? 'perto' : ''} ${carregado ? 'chegou' : ''}`}>
      <div
        className="giro-caixa"
        ref={caixaRef}
        role="img"
        aria-label={`${rotulo}. Arraste para os lados ou use as setas para girar.`}
        tabIndex={0}
        data-cursor="Girar"
      >
        <canvas ref={canvasRef} className="giro-canvas" />
      </div>
      <div className="giro-rodape">
        <span className={`giro-dica ${dica ? '' : 'some'}`} aria-hidden>
          <span className="giro-seta">‹</span> arraste para girar <span className="giro-seta">›</span>
        </span>
        {aproximar && (
          <button type="button" className="giro-zoom" aria-pressed={zoom} onClick={() => setZoom((z) => !z)}>
            {zoom ? 'Afastar' : 'Aproximar'}
          </button>
        )}
      </div>
      {!pronto && carregado > 0 && (
        <span className="giro-carga" style={{ transform: `scaleX(${carregado / seq.quadros})` }} aria-hidden />
      )}
    </div>
  )
}
