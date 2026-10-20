// Figura da logo no topo. Primeiro aparece a imagem (rápida, sem esperar nada);
// logo depois da abertura, ela é trocada pelo relevo de ouro em 3D, que acende devagar.
// Sem WebGL, com economia de dados ou se algo falhar, a imagem simplesmente fica.
import { useEffect, useRef, useState } from 'react'
import type { Relevo } from './tres/relevo'

const FONTE = '/figura.webp'

function podeUsar3D() {
  const economia = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
  if (economia) return false
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export function HeroFigura() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [aceso, setAceso] = useState(false)
  const [usar3D] = useState(podeUsar3D)

  useEffect(() => {
    if (!usar3D) return
    const canvas = canvasRef.current!
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let relevo: Relevo | null = null
    let cancelado = false
    let visivel = true
    const tela = new IntersectionObserver(([e]) => {
      visivel = e.isIntersecting
      relevo?.pausar(!visivel)
    })
    tela.observe(canvas)
    // Espera a abertura terminar para o cálculo do relevo não disputar com a animação
    const espera = window.setTimeout(
      async () => {
        try {
          const m = await import('./tres/relevo')
          if (cancelado) return
          const r = await m.montarRelevo(canvas, FONTE, { reduzido, aoPronto: () => !cancelado && setAceso(true) })
          if (cancelado) r.descartar()
          else {
            relevo = r
            r.pausar(!visivel)
          }
        } catch {
          // Fica a imagem
        }
      },
      reduzido ? 200 : 2300,
    )
    return () => {
      cancelado = true
      window.clearTimeout(espera)
      tela.disconnect()
      relevo?.descartar()
    }
  }, [usar3D])

  return (
    <div className={`hero-figure ${aceso ? 'aceso' : ''}`} aria-hidden>
      <img src={FONTE} alt="" width="698" height="409" />
      {usar3D && <canvas ref={canvasRef} className="hero-relevo" />}
    </div>
  )
}
