// Vitrine dos Serviços: cada categoria é um desenho em traço de ouro que se desenha sozinho,
// com um brilho que passa por cima. É só SVG e CSS, sem 3D, então não pesa nem trava no celular.
import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'

export type Aba = 'cabelo' | 'unhas' | 'estetica'

export const ESMALTES = [
  { nome: 'Rosa', cor: '#c7536a' },
  { nome: 'Vermelho', cor: '#b3243a' },
  { nome: 'Nude', cor: '#d9a08c' },
  { nome: 'Vinho', cor: '#6e1f33' },
  { nome: 'Dourado', cor: '#d4a43c' },
]

const NUMERO: Record<Aba, string> = { cabelo: '01', unhas: '02', estetica: '03' }

// Cada traço recebe um atraso para o desenho sair em sequência
const t = (i: number) => ({ '--i': i }) as CSSProperties

function Cabelo() {
  return (
    <>
      {/* Mechas caindo atrás da tesoura */}
      <path style={t(0)} d="M70 60 C40 140 120 190 80 270 C60 310 80 340 96 360" />
      <path style={t(1)} d="M96 52 C70 130 150 186 112 268 C94 306 112 336 126 356" />
      <path style={t(2)} d="M124 48 C104 120 176 180 142 262" />
      {/* Tesoura aberta */}
      <path style={t(3)} d="M204 196 L132 62 Q140 54 150 60 L214 186" />
      <path style={t(4)} d="M212 196 L300 70 Q308 74 304 86 L222 202" />
      <circle style={t(5)} cx="210" cy="198" r="7" />
      <path style={t(6)} d="M204 206 L172 262" />
      <path style={t(6)} d="M218 208 L254 260" />
      <circle style={t(7)} cx="160" cy="292" r="32" />
      <circle style={t(8)} cx="266" cy="290" r="32" />
      {/* Pente */}
      <path style={t(10)} d="M300 150 L356 150 Q362 150 362 156 L362 168 L300 168 Z" />
      <path style={t(11)} d="M306 168 V196 M314 168 V196 M322 168 V196 M330 168 V196 M338 168 V196 M346 168 V196 M354 168 V196" />
      <Brilho x={324} y={98} i={12} />
      <Brilho x={110} y={330} i={13} pequeno />
    </>
  )
}

function Unhas() {
  return (
    <>
      {/* Frasco de esmalte */}
      <rect style={t(0)} x="148" y="40" width="44" height="88" rx="8" />
      <path style={t(1)} d="M156 60 H184 M156 76 H184 M156 92 H184 M156 108 H184" />
      <rect style={t(2)} x="140" y="128" width="60" height="18" rx="3" />
      <path style={t(3)} d="M140 146 Q100 150 100 196 L100 300 Q100 338 138 338 L202 338 Q240 338 240 300 L240 196 Q240 150 200 146" />
      <path className="esmalte-liquido" style={t(4)} d="M112 210 Q170 196 228 210 L228 298 Q228 326 200 326 L140 326 Q112 326 112 298 Z" />
      <path style={t(5)} d="M120 222 Q122 270 128 304" className="reflexo" />
      {/* Unhas postiças em leque */}
      <g transform="translate(290 210) rotate(-24)">
        <path className="esmalte-liquido" style={t(6)} d="M0 -52 C18 -52 24 -26 24 0 L24 30 Q24 40 12 40 L-12 40 Q-24 40 -24 30 L-24 0 C-24 -26 -18 -52 0 -52 Z" />
      </g>
      <g transform="translate(330 250) rotate(0)">
        <path className="esmalte-liquido" style={t(7)} d="M0 -52 C18 -52 24 -26 24 0 L24 30 Q24 40 12 40 L-12 40 Q-24 40 -24 30 L-24 0 C-24 -26 -18 -52 0 -52 Z" />
      </g>
      <g transform="translate(362 304) rotate(24)">
        <path className="esmalte-liquido" style={t(8)} d="M0 -46 C16 -46 20 -24 20 0 L20 26 Q20 34 10 34 L-10 34 Q-20 34 -20 26 L-20 0 C-20 -24 -16 -46 0 -46 Z" />
      </g>
      <Brilho x={256} y={84} i={10} />
      <Brilho x={60} y={176} i={11} pequeno />
    </>
  )
}

function Estetica() {
  return (
    <>
      {/* Espelho de mão com o olhar dentro */}
      <ellipse style={t(0)} cx="200" cy="170" rx="118" ry="134" />
      <ellipse style={t(1)} cx="200" cy="170" rx="104" ry="120" />
      <path style={t(2)} d="M186 304 L186 370 Q200 382 214 370 L214 304" />
      {/* Sobrancelha */}
      <path style={t(3)} d="M122 128 Q176 92 262 120 Q270 124 264 128 Q190 108 128 136 Z" />
      {/* Olho */}
      <path style={t(4)} d="M120 184 Q200 118 280 184" />
      <path style={t(5)} d="M120 184 Q200 236 280 184" />
      <circle style={t(6)} cx="200" cy="180" r="28" />
      <circle className="pupila" style={t(7)} cx="200" cy="180" r="11" />
      <path style={t(8)} d="M138 168 L128 152 M160 156 L154 138 M184 150 L182 130 M208 148 L210 128 M232 152 L238 133 M256 162 L266 146" />
      <Brilho x={300} y={66} i={9} />
      <Brilho x={92} y={268} i={10} pequeno />
      <Brilho x={322} y={290} i={11} pequeno />
    </>
  )
}

function Brilho({ x, y, i, pequeno }: { x: number; y: number; i: number; pequeno?: boolean }) {
  const r = pequeno ? 9 : 16
  return (
    <path
      className="brilho"
      style={t(i)}
      d={`M${x} ${y - r} Q${x + r * 0.16} ${y - r * 0.16} ${x + r} ${y} Q${x + r * 0.16} ${y + r * 0.16} ${x} ${y + r} Q${x - r * 0.16} ${y + r * 0.16} ${x - r} ${y} Q${x - r * 0.16} ${y - r * 0.16} ${x} ${y - r} Z`}
    />
  )
}

export function VitrineOuro({ aba, cor, rotulo }: { aba: Aba; cor: string; rotulo: string }) {
  const ref = useRef<HTMLDivElement>(null)

  // Com comprimento 1 em cada traço, o CSS desenha qualquer forma do zero até o fim
  useLayoutEffect(() => {
    ref.current!.querySelectorAll('.tracos path, .tracos circle, .tracos ellipse, .tracos rect').forEach((f) => f.setAttribute('pathLength', '1'))
  }, [aba])

  // O desenho acompanha o mouse de leve, com no máximo uma conta por quadro
  useEffect(() => {
    const el = ref.current!
    if (!window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) return
    let quadro = 0
    let x = 0
    let y = 0
    const mover = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      x = (e.clientX - r.left) / r.width - 0.5
      y = (e.clientY - r.top) / r.height - 0.5
      if (!quadro)
        quadro = requestAnimationFrame(() => {
          quadro = 0
          el.style.setProperty('--mx', x.toFixed(3))
          el.style.setProperty('--my', y.toFixed(3))
        })
    }
    el.addEventListener('pointermove', mover)
    return () => {
      el.removeEventListener('pointermove', mover)
      cancelAnimationFrame(quadro)
    }
  }, [])

  return (
    <div className="vitrine" ref={ref} style={{ '--esmalte': cor } as CSSProperties}>
      <span className="vitrine-numero" aria-hidden>
        {NUMERO[aba]}
      </span>
      <div className="vitrine-aro" aria-hidden />
      <svg className="vitrine-desenho" key={aba} viewBox="0 0 400 400" role="img" aria-label={rotulo}>
        <defs>
          <linearGradient id="traco-ouro" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f6dc9a" />
            <stop offset="0.45" stopColor="#e2b04e" />
            <stop offset="1" stopColor="#8c6418" />
          </linearGradient>
        </defs>
        <g className="tracos">{aba === 'cabelo' ? <Cabelo /> : aba === 'unhas' ? <Unhas /> : <Estetica />}</g>
      </svg>
      <div className="vitrine-luz" aria-hidden />
    </div>
  )
}
