import { useId } from 'react'

// A Leidinha: a mulher dourada da logo em versão cartoon.
// Da logo vêm o cabelo longo que voa para a direita e sobe na ponta, as mechas
// enroladas do lado esquerdo, a tesoura e o pente dourados, e o degradê pêssego → amarelo.
export type Humor = 'oi' | 'agendar' | 'oferta' | 'vazio' | 'festa'

type Props = {
  humor?: Humor
  // Só a cabeça, para tamanhos pequenos (ícone, aba, avisos)
  mini?: boolean
  size?: number
  className?: string
  // Texto para leitores de tela; sem ele a ilustração é decorativa
  titulo?: string
}

const PELE = '#FFE6D2'
const OLHO = '#4A2C1A'
const BOCHECHA = '#F4A39A'

export function Mascote({ humor = 'oi', mini = false, size = 120, className = '', titulo }: Props) {
  const id = useId().replace(/:/g, '')
  const cabelo = `cab-${id}`
  const vestido = `ves-${id}`
  const ouro = `ouro-${id}`
  const feliz = humor === 'festa' || humor === 'agendar'

  return (
    <svg
      viewBox={mini ? '8 10 120 90' : '0 0 130 150'}
      width={size}
      height={mini ? (size * 90) / 120 : (size * 150) / 130}
      className={`mascote humor-${humor} ${mini ? 'mini' : ''} ${className}`}
      role={titulo ? 'img' : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
    >
      <defs>
        <linearGradient id={cabelo} x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0" stopColor="#EE9B4B" />
          <stop offset="0.55" stopColor="#F7BE57" />
          <stop offset="1" stopColor="#FFE07A" />
        </linearGradient>
        <linearGradient id={vestido} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F9E7BE" />
          <stop offset="1" stopColor="#F0CD7F" />
        </linearGradient>
        <linearGradient id={ouro} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F2B04C" />
          <stop offset="1" stopColor="#C98A2E" />
        </linearGradient>
      </defs>

      {/* Mechas enroladas da logo, do lado esquerdo */}
      <g className="m-mechas" fill="none" stroke={`url(#${cabelo})`} strokeLinecap="round">
        <path d="M30 74c-11-2-17-11-13-21 2-5 7-6 9-3" strokeWidth="3.2" />
        <path d="M27 88c-13 1-21-7-19-17 1-4 5-5 7-2" strokeWidth="2.6" />
        {!mini && <path d="M33 101c-10 4-19 0-20-8" strokeWidth="2.2" />}
      </g>

      {/* Cabelo de trás: cai pelos ombros e voa para a direita, subindo na ponta como na logo */}
      <g className="m-cabelo">
        <path
          d="M36 94C23 72 23 37 50 24c16-8 36-6 48 4 8 6 17 6 24-4 4 16-6 30-19 31 1 16-3 30-12 39q-27 7-55 0z"
          fill={`url(#${cabelo})`}
        />
        <path d="M92 64c13 5 25 0 32-10-1 15-12 25-30 26z" fill={`url(#${cabelo})`} />
        <path d="M100 32c7 4 14 3 19-3" fill="none" stroke="#FFE9A6" strokeWidth="2" strokeLinecap="round" opacity=".8" />
      </g>

      {/* Corpo */}
      {!mini && (
        <g className="m-corpo">
          <rect x="58" y="84" width="10" height="8" rx="3" fill={PELE} />
          <path d="M48 90h30c3 0 5 2 6 5l8 30c1 4-2 7-6 7H40c-4 0-7-3-6-7l8-30c1-3 3-5 6-5z" fill={`url(#${vestido})`} />
          <path d="M51 90q12 9 24 0" fill="none" stroke="#E2B04E" strokeWidth="2" strokeLinecap="round" />
          <path d="M37 124h52" stroke="#E2B04E" strokeWidth="2" strokeLinecap="round" opacity=".7" />
          <ellipse cx="54" cy="136" rx="6" ry="3.4" fill="#B97B34" />
          <ellipse cx="72" cy="136" rx="6" ry="3.4" fill="#B97B34" />
          <Bracos humor={humor} ouro={`url(#${ouro})`} />
        </g>
      )}

      {/* Rosto */}
      <g className="m-cabeca">
        <ellipse cx="63" cy="58" rx="25" ry="24" fill={PELE} />
        {/* Franja varrida de lado, como o cabelo da logo */}
        <path
          d="M37 62c-3-20 10-35 29-35 15 0 25 10 24 25-6-9-16-14-27-11-6 2-11 6-14 12-3-5-8-6-12 9z"
          fill={`url(#${cabelo})`}
        />
        <path d="M58 32c9-3 19 0 25 8" fill="none" stroke="#FFF0BF" strokeWidth="2.2" strokeLinecap="round" opacity=".7" />

        <Olhos humor={humor} />
        <ellipse cx="50" cy="68" rx="4.6" ry="2.6" fill={BOCHECHA} opacity=".55" />
        <ellipse cx="77" cy="68" rx="4.6" ry="2.6" fill={BOCHECHA} opacity=".55" />
        <Boca humor={humor} />
      </g>

      {/* Pente dourado da logo preso no cabelo */}
      <g className="m-pente" transform="rotate(28 92 30)">
        <rect x="86" y="24" width="13" height="5" rx="2" fill={`url(#${ouro})`} />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={87 + i * 2.5} y="28" width="1.3" height="4" rx=".6" fill="#C98A2E" />
        ))}
      </g>

      {(humor === 'festa' || humor === 'oferta') && <Brilhos />}
      {feliz && !mini && humor === 'festa' && (
        <g className="m-confete">
          <circle cx="20" cy="30" r="2.4" fill="#F4A39A" />
          <circle cx="112" cy="70" r="2" fill="#F0CD7F" />
          <rect x="16" y="112" width="4" height="4" rx="1" fill="#E2B04E" transform="rotate(20 18 114)" />
        </g>
      )}
    </svg>
  )
}

function Olhos({ humor }: { humor: Humor }) {
  if (humor === 'festa' || humor === 'agendar') {
    // Olhos fechados de sorriso
    return (
      <g fill="none" stroke={OLHO} strokeWidth="2.4" strokeLinecap="round">
        <path d="M50 61q4-5 8 0" />
        <path d="M68 61q4-5 8 0" />
      </g>
    )
  }
  const olhar = humor === 'vazio' ? 2 : 0
  return (
    <g className="m-olhos">
      <ellipse cx="54" cy={60 + olhar} rx="3" ry="3.8" fill={OLHO} />
      <ellipse cx="72" cy={60 + olhar} rx="3" ry="3.8" fill={OLHO} />
      <circle cx="55.1" cy={58.6 + olhar} r="1.1" fill="#fff" />
      <circle cx="73.1" cy={58.6 + olhar} r="1.1" fill="#fff" />
    </g>
  )
}

function Boca({ humor }: { humor: Humor }) {
  if (humor === 'vazio') return <ellipse cx="63" cy="71" rx="2.2" ry="2.6" fill="#C4566B" />
  if (humor === 'festa' || humor === 'oferta')
    return <path d="M58 70q5 7 10 0z" fill="#C4566B" stroke={OLHO} strokeWidth="1.2" strokeLinejoin="round" />
  return <path d="M58 70q5 5 10 0" fill="none" stroke={OLHO} strokeWidth="2" strokeLinecap="round" />
}

function Bracos({ humor, ouro }: { humor: Humor; ouro: string }) {
  const braco = { fill: 'none', stroke: PELE, strokeWidth: 6, strokeLinecap: 'round' as const }
  switch (humor) {
    case 'oi':
      // Acena com a mão direita
      return (
        <>
          <path d="M45 97q-7 9-6 17" {...braco} />
          <g className="m-aceno">
            <path d="M81 97q9-6 12-18" {...braco} />
          </g>
        </>
      )
    case 'agendar':
      // Segura a tesoura da logo
      return (
        <>
          <path d="M45 97q-7 9-6 17" {...braco} />
          <path d="M81 97q8 2 12-6" {...braco} />
          <Tesoura x={92} y={78} ouro={ouro} />
        </>
      )
    case 'oferta':
      // Mostra uma etiqueta de presente
      return (
        <>
          <path d="M45 97q-7 9-6 17" {...braco} />
          <path d="M81 97q9 1 13-4" {...braco} />
          <g transform="rotate(-12 102 88)">
            <path d="M94 80h14a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H94l-6-9z" fill={ouro} />
            <circle cx="93" cy="89" r="1.8" fill="#FFF6E0" />
            <path d="M102 93c-5-3-6-6-4-8 1.5-1.5 3.3-.6 4 .8.7-1.4 2.5-2.3 4-.8 2 2 1 5-4 8z" fill="#FFF6E0" />
          </g>
        </>
      )
    case 'vazio':
      // Mão no queixo, pensando
      return (
        <>
          <path d="M45 97q-7 9-6 17" {...braco} />
          <path d="M81 98q4 8-6 6q-5-1-5-12" {...braco} />
        </>
      )
    case 'festa':
      // Dois braços para cima
      return (
        <>
          <path d="M45 96q-10-5-12-17" {...braco} />
          <path d="M81 96q10-5 12-17" {...braco} />
        </>
      )
  }
}

function Tesoura({ x, y, ouro }: { x: number; y: number; ouro: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(-20)`}>
      <path d="M0 0l-4 14M2 0l4 14" stroke={ouro} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="-5" cy="17" r="3.4" fill="none" stroke={ouro} strokeWidth="2" />
      <circle cx="7" cy="17" r="3.4" fill="none" stroke={ouro} strokeWidth="2" />
    </g>
  )
}

function Brilhos() {
  const estrela = 'M0-6C1-1 1-1 6 0 1 1 1 1 0 6-1 1-1 1-6 0-1-1-1-1 0-6z'
  return (
    <g className="m-brilhos" fill="#F2B04C">
      <path d={estrela} transform="translate(24 22) scale(.9)" />
      <path d={estrela} transform="translate(116 52) scale(.7)" />
      <path d={estrela} transform="translate(108 14) scale(.5)" />
    </g>
  )
}
