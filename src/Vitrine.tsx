// Vitrine dos Serviços: cada categoria mostra uma peça fotografada em estúdio que gira em 360° quando a
// cliente arrasta. As fotos foram renderizadas a partir de modelos 3D, então a peça é sempre a mesma em
// todos os ângulos. É só imagem num canvas, sem 3D no navegador, então não pesa nem trava no celular.
import { useEffect, useRef, type CSSProperties } from 'react'
import { Giro360, type Sequencia } from './Giro360'

export type Aba = 'cabelo' | 'unhas' | 'estetica'
export type PecaCabelo = 'secador' | 'tesoura'

export const ESMALTES = [
  { nome: 'Vermelho', cor: '#b3243a', pasta: 'vermelho' },
  { nome: 'Rosa', cor: '#c7536a', pasta: 'rosa' },
  { nome: 'Nude', cor: '#d9a08c', pasta: 'nude' },
  { nome: 'Vinho', cor: '#6e1f33', pasta: 'vinho' },
  { nome: 'Dourado', cor: '#d4a43c', pasta: 'dourado' },
]

const NUMERO: Record<Aba, string> = { cabelo: '01', unhas: '02', estetica: '03' }

export const PECAS_CABELO: { key: PecaCabelo; nome: string; rotulo: string }[] = [
  { key: 'secador', nome: 'Secador', rotulo: 'Secador profissional preto com detalhes dourados' },
  { key: 'tesoura', nome: 'Tesoura', rotulo: 'Tesoura de corte em aço inox com parafuso dourado' },
]

const SEQ_CABELO: Record<PecaCabelo, Sequencia> = {
  secador: { pasta: '/giro/secador', quadros: 60 },
  tesoura: { pasta: '/giro/tesoura', quadros: 60 },
}
const SEQ_MUSA: Sequencia = { pasta: '/giro/musa', quadros: 72 }
const seqEsmalte = (pasta: string): Sequencia => ({ pasta: `/giro/esmalte-${pasta}`, quadros: 48 })

export function VitrineOuro({
  aba,
  cor,
  peca,
  rotulo,
}: {
  aba: Aba
  cor: string
  peca: PecaCabelo
  rotulo: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  // O número e o aro acompanham o mouse de leve, com no máximo uma conta por quadro
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

  const esmalte = ESMALTES.find((e) => e.cor === cor) ?? ESMALTES[0]
  const seq = aba === 'cabelo' ? SEQ_CABELO[peca] : aba === 'unhas' ? seqEsmalte(esmalte.pasta) : SEQ_MUSA

  return (
    <div className="vitrine" ref={ref} style={{ '--esmalte': cor } as CSSProperties}>
      <span className="vitrine-numero" aria-hidden>
        {NUMERO[aba]}
      </span>
      <div className="vitrine-aro" aria-hidden />
      <div className="vitrine-peca" key={aba}>
        <Giro360 key={seq.pasta} seq={seq} rotulo={rotulo} aproximar={aba === 'estetica'} />
      </div>
      <div className="vitrine-luz" aria-hidden />
    </div>
  )
}
