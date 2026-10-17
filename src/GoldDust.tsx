import { useEffect, useRef } from 'react'

type Particle = { x: number; y: number; r: number; vx: number; vy: number; a: number; phase: number }

// Partículas douradas flutuando devagar atrás da logo. Desliga com "reduzir movimento".
export default function GoldDust({ count = 46 }: { count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let w = 0
    let h = 0
    let raf = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const particles: Particle[] = []

    function resize() {
      w = canvas!.clientWidth
      h = canvas!.clientHeight
      canvas!.width = w * dpr
      canvas!.height = h * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function spawn(randomY: boolean): Particle {
      return {
        x: Math.random() * w,
        y: randomY ? Math.random() * h : h + 10,
        r: 0.6 + Math.random() * 1.8,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -(0.12 + Math.random() * 0.35),
        a: 0.25 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
      }
    }

    resize()
    for (let i = 0; i < count; i++) particles.push(spawn(true))

    function frame(t: number) {
      ctx!.clearRect(0, 0, w, h)
      for (const p of particles) {
        p.x += p.vx + Math.sin(t / 2400 + p.phase) * 0.12
        p.y += p.vy
        if (p.y < -10) Object.assign(p, spawn(false))
        const twinkle = 0.55 + 0.45 * Math.sin(t / 700 + p.phase)
        const g = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4)
        g.addColorStop(0, `rgba(246, 226, 160, ${p.a * twinkle})`)
        g.addColorStop(1, 'rgba(217, 184, 102, 0)')
        ctx!.fillStyle = g
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2)
        ctx!.fill()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const onVisibility = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden) raf = requestAnimationFrame(frame)
    }
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [count])

  return <canvas ref={ref} className="gold-dust" aria-hidden />
}
