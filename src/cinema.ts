// Movimento do site: abertura, rolagem suave e as cenas que andam com a rolagem.
// Tudo fica aqui para o App só cuidar do agendamento.
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

const REDUZIDO = '(prefers-reduced-motion: reduce)'

let lenis: Lenis | null = null

export function scrollToY(top: number) {
  if (lenis) lenis.scrollTo(top, { duration: 1.4 })
  else window.scrollTo({ top, behavior: 'smooth' })
}

// Rolagem com inércia, como nos sites premiados. Quem pediu menos movimento no celular fica com a rolagem normal.
export function rolagemSuave() {
  if (window.matchMedia(REDUZIDO).matches) return () => {}
  lenis = new Lenis({ lerp: 0.09, anchors: true })
  lenis.on('scroll', ScrollTrigger.update)
  const tick = (t: number) => lenis?.raf(t * 1000)
  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(0)
  return () => {
    gsap.ticker.remove(tick)
    lenis?.destroy()
    lenis = null
  }
}

// Abertura: contador de 0 a 100, a cortina sobe, a figura abre e o título nasce letra por letra.
export function abertura(root: HTMLElement) {
  const reduzido = window.matchMedia(REDUZIDO).matches
  let soltar = () => {}
  const ctx = gsap.context(() => {
    // Quem pediu menos movimento entra direto no site pronto, sem cortina
    if (reduzido) {
      gsap.set('.loader', { autoAlpha: 0 })
      return
    }
    const contador = root.querySelector<HTMLElement>('.loader-count')!
    const n = { v: 0 }
    lenis?.stop()
    gsap.set('.hero-title .letra', { yPercent: reduzido ? 0 : 115, opacity: reduzido ? 0 : 1 })
    gsap.set('.hero-figure', { clipPath: 'inset(50% 0% 50% 0%)' })
    gsap.set('.hero-figure img', { scale: reduzido ? 1 : 1.3 })
    gsap.set('.hero-disco', { scale: 0 })
    gsap.set('.tarjas span', { scaleY: 1 })
    gsap.set('.loader-name .letra', { opacity: 0, yPercent: reduzido ? 0 : 100 })
    gsap.set(['.hero-sub', '.hero-actions', '.hero-scroll', '.topbar'], { opacity: 0, y: reduzido ? 0 : 24 })

    // A abertura é curta: em menos de dois segundos o site já pode ser rolado.
    // Quem rola, toca ou aperta uma tecla durante a abertura faz ela correr mais rápido.
    const tl = gsap.timeline()
    tl.to('.loader-name .letra', { opacity: 1, yPercent: 0, stagger: 0.04, duration: 0.55, ease: 'power3.out' }, 0)
      .to(n, {
        v: 100,
        duration: 0.95,
        ease: 'power2.inOut',
        onUpdate: () => {
          contador.textContent = String(Math.round(n.v))
        },
      }, 0)
      .to('.loader-bar', { scaleX: 1, duration: 0.95, ease: 'power2.inOut' }, 0)
      .to('.loader-inner', { opacity: 0, duration: 0.25 }, 0.95)
      .to('.loader', { yPercent: -100, duration: 0.9, ease: 'expo.inOut' }, 1.0)
      .add(() => lenis?.start(), 1.6)
      .to('.hero-disco', { scale: 1, duration: 2, ease: 'expo.out' }, 1.15)
      .to('.hero-figure', { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut', clearProps: 'clipPath' }, 1.2)
      .to('.hero-figure img', { scale: 1, duration: 2, ease: 'expo.out' }, 1.2)
      .to('.hero-title .letra', {
        yPercent: 0,
        opacity: 1,
        duration: 1.2,
        stagger: 0.04,
        ease: 'expo.out',
      }, 1.45)
      .to(['.topbar', '.hero-sub', '.hero-actions', '.hero-scroll'], {
        opacity: 1,
        y: 0,
        duration: 0.9,
        stagger: 0.08,
        ease: 'power3.out',
      }, 1.85)
      // As tarjas de cinema se abrem por último, revelando a tela inteira
      .to('.tarjas span', { scaleY: 0, duration: 1.4, ease: 'expo.inOut' }, 2.0)
    const pressa = () => tl.timeScale(3.5)
    const eventos = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const
    eventos.forEach((e) => window.addEventListener(e, pressa, { once: true, passive: true }))
    soltar = () => eventos.forEach((e) => window.removeEventListener(e, pressa))
    tl.eventCallback('onComplete', () => {
      lenis?.start()
      soltar()
    })
  }, root)
  return () => {
    soltar()
    ctx.revert()
  }
}

// As cenas que acompanham a rolagem.
export function cenas(root: HTMLElement) {
  const mm = gsap.matchMedia(root)

  // Valem para todo mundo: só mudam a opacidade, sem deslocamento grande
  mm.add('all', () => {
    gsap.fromTo(
      '.manifesto .palavra',
      { opacity: 0.14 },
      {
        opacity: 1,
        stagger: 0.06,
        ease: 'none',
        scrollTrigger: { trigger: '.manifesto-texto', start: 'top 80%', end: 'bottom 55%', scrub: true },
      },
    )
  })

  mm.add({ computador: '(min-width: 900px)', reduzido: REDUZIDO }, (c) => {
    const { computador, reduzido } = c.conditions as { computador: boolean; reduzido: boolean }
    if (reduzido) return

    // O topo se afasta como uma tela de cinema: encolhe, arredonda e as palavras se separam.
    // No computador ele fica parado um pouco enquanto isso acontece.
    const saida = gsap.timeline({
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: computador ? '+=90%' : 'bottom top',
        scrub: true,
        pin: computador,
      },
    })
    saida
      .to('.hero-stage', { scale: computador ? 0.84 : 0.9, borderRadius: 28, ease: 'none' }, 0)
      .to('.hero-figure', { yPercent: 14, scale: 1.1, ease: 'none' }, 0)
      .to('.hero-disco', { scale: 1.3, ease: 'none' }, 0)
      .to('.hero-title .linha-1', { xPercent: -16, ease: 'none' }, 0)
      .to('.hero-title .linha-2', { xPercent: 16, ease: 'none' }, 0)
      .to('.hero-foot', { opacity: 0, ease: 'none' }, 0)

    // Faixa: anda sozinha e acelera (ou volta) conforme a velocidade da rolagem
    const trilho = root.querySelector('.faixa-trilho')
    if (trilho) {
      const loop = gsap.to(trilho, { xPercent: -50, duration: 40, ease: 'none', repeat: -1 })
      const volta = gsap.quickTo(loop, 'timeScale', { duration: 0.6, ease: 'power3.out' })
      ScrollTrigger.create({
        trigger: '.faixa',
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          const v = self.getVelocity() / 140
          volta(gsap.utils.clamp(-6, 6, self.direction * Math.max(1, Math.abs(v))))
        },
      })
      gsap.to('.faixa', {
        rotate: -2,
        ease: 'none',
        scrollTrigger: { trigger: '.faixa', start: 'top bottom', end: 'bottom top', scrub: true },
      })
    }

    // Títulos das seções sobem de dentro de uma máscara
    gsap.utils.toArray<HTMLElement>('.surge').forEach((el) => {
      gsap.from(el.querySelectorAll('.letra'), {
        yPercent: 110,
        duration: 1.1,
        stagger: 0.03,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 85%' },
      })
    })

    // Assinatura do rodapé
    gsap.from('.footer-wordmark .letra', {
      yPercent: 100,
      duration: 1.2,
      stagger: 0.04,
      ease: 'expo.out',
      scrollTrigger: { trigger: '.footer-wordmark', start: 'top 95%' },
    })
  })

  // Serviços: a tela do estúdio abre como uma íris quando a área chega
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    gsap.fromTo(
      '.servicos-cena',
      { clipPath: 'inset(9% 7% 9% 7% round 28px)' },
      {
        clipPath: 'inset(0% 0% 0% 0% round 0px)',
        ease: 'none',
        scrollTrigger: { trigger: '.servicos', start: 'top bottom', end: 'top top', scrub: true },
      },
    )
  })

  return () => mm.revert()
}

// Cursor próprio no computador: um ponto que cresce e mostra "Agendar" sobre os botões
export function cursor() {
  if (!window.matchMedia('(pointer: fine)').matches) return () => {}
  const el = document.querySelector<HTMLElement>('.cursor')
  if (!el) return () => {}
  const x = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3.out' })
  const y = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' })
  const mover = (e: PointerEvent) => {
    x(e.clientX)
    y(e.clientY)
    const alvo = (e.target as Element | null)?.closest?.('[data-cursor]')
    el.classList.toggle('grande', !!alvo)
    el.dataset.label = alvo?.getAttribute('data-cursor') ?? ''
  }
  window.addEventListener('pointermove', mover)
  el.classList.add('on')
  return () => {
    window.removeEventListener('pointermove', mover)
    el.classList.remove('on')
  }
}

export function atualizarCenas() {
  ScrollTrigger.refresh()
}
