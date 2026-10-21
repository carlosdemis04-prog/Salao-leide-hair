// A figura da logo em ouro de verdade: o desenho vira um relevo (cada mecha do cabelo ganha volume),
// a superfície é metal com reflexos de estúdio, e uma luz quente passa por cima seguindo o ponteiro.
// Tudo é feito a partir do próprio desenho da logo, no navegador, sem modelo baixado.
import * as THREE from 'three'
import { texturasDaFigura } from './figura'

export type Relevo = {
  pausar: (sim: boolean) => void
  descartar: () => void
}

// Margem em volta da figura para ela poder inclinar sem cortar (o canvas é 12% maior que a imagem)
export const FOLGA = 1.12

// Sala de reflexos própria do relevo: uma cúpula em degradê (clara e quente em cima, escura embaixo,
// sem emenda dura), uma caixa de luz no alto e faixas nas laterais para os chanfros brilharem.
// Tudo simétrico na frente e atrás, porque uma placa virada para a câmera reflete os dois lados
// dependendo de como inclina.
export function salaDoRelevo() {
  const s = new THREE.Scene()
  const cupula = new THREE.SphereGeometry(15, 48, 32)
  const cores: number[] = []
  const pos = cupula.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const ny = pos.getY(i) / 15
    const k = 0.05 + Math.pow(THREE.MathUtils.smoothstep(ny, -0.7, 1), 1.6) * 1.25
    cores.push(1 * k, 0.84 * k, 0.62 * k)
  }
  cupula.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3))
  s.add(new THREE.Mesh(cupula, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })))
  const painel = (w: number, h: number, cor: number, forca: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(cor).multiplyScalar(forca), side: THREE.DoubleSide }),
    )
    m.position.set(x, y, z)
    m.lookAt(0, 0, 0)
    s.add(m)
  }
  painel(10, 3, 0xfff0da, 2.4, 0, 9, 0)
  for (const z of [4, -4]) {
    painel(1.6, 9, 0xffc98a, 1.8, -9, 1.5, z)
    painel(1.6, 9, 0xfff4ea, 1.1, 9, 1.5, z)
  }
  return s
}

export async function montarRelevo(
  canvas: HTMLCanvasElement,
  fonte: string,
  opcoes: { reduzido: boolean; aoPronto: () => void },
): Promise<Relevo> {
  const celular = window.matchMedia('(pointer: coarse)').matches
  const t = await texturasDaFigura(fonte, celular ? 960 : 1500)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, celular ? 1.5 : 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0
  renderer.setClearColor(0x000000, 0)

  const cena = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const sala = salaDoRelevo()
  const ambiente = pmrem.fromScene(sala, 0.03).texture
  sala.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) {
      m.geometry.dispose()
      ;(m.material as THREE.Material).dispose()
    }
  })
  cena.environment = ambiente
  cena.environmentIntensity = 0.85

  // Placa com relevo de verdade (a malha sobe com o mapa de altura) e o detalhe fino nas normais
  const segmentos = celular ? 220 : 380
  const geo = new THREE.PlaneGeometry(t.aspecto, 1, segmentos, Math.round(segmentos / t.aspecto))
  const mat = new THREE.MeshPhysicalMaterial({
    map: t.cor,
    normalMap: t.normal,
    displacementMap: t.altura,
    displacementScale: 0.06,
    metalness: 1,
    roughness: 0.28,
    clearcoat: 0.25,
    clearcoatRoughness: 0.25,
    transparent: true,
    alphaTest: 0.04,
    // O canvas é composto por cima do brilho dourado do topo, que espera cores pré-multiplicadas
    premultipliedAlpha: true,
  })
  const placa = new THREE.Mesh(geo, mat)
  const grupo = new THREE.Group()
  grupo.add(placa)
  cena.add(grupo)

  // Luz quente que corre por cima do ouro (segue o ponteiro), mais uma luz alta e suave fixa
  const corrida = new THREE.PointLight(0xffdcae, 0, 0, 2)
  corrida.position.set(-0.6, 0.3, 0.8)
  cena.add(corrida)
  const alta = new THREE.DirectionalLight(0xfff0da, 0.9)
  alta.position.set(-1.5, 2.5, 2)
  cena.add(alta)

  const camera = new THREE.PerspectiveCamera(18, t.aspecto, 0.1, 20)
  const distancia = FOLGA / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  camera.position.set(0, 0, distancia)
  camera.lookAt(0, 0, 0)

  function ajustar() {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(() => {
    ajustar()
    if (opcoes.reduzido || pausado) renderer.render(cena, camera)
  })
  ro.observe(canvas)
  ajustar()

  // Ponteiro em coordenadas da tela inteira (o topo ocupa a tela toda)
  const mira = new THREE.Vector2(-0.5, 0.35)
  let mexeu = false
  const aoMover = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    mexeu = true
    mira.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1))
  }
  window.addEventListener('pointermove', aoMover, { passive: true })

  const luzAtual = new THREE.Vector2(-1.2, 0.5)
  const giro = new THREE.Vector2()
  const alvo = new THREE.Vector2()
  let tempo = 0
  let acender = opcoes.reduzido ? 1 : 0
  let inicio = -1
  let pausado = false
  let pronto = false
  let ultimo = performance.now()
  let raf = 0

  function quadro(agora: number) {
    const dt = Math.min((agora - ultimo) / 1000, 0.05)
    ultimo = agora
    tempo += dt
    // A luz acende devagar sobre o ouro, como um refletor ligando (pelo relógio, não pelos quadros)
    if (inicio < 0) inicio = agora
    acender = opcoes.reduzido ? 1 : Math.min(1, (agora - inicio) / 1800)
    const k = 1 - Math.pow(1 - acender, 3)
    renderer.toneMappingExposure = 0.95 * k
    corrida.intensity = 1.2 * k

    if (opcoes.reduzido) {
      luzAtual.set(-0.35, 0.3)
    } else if (mexeu) {
      luzAtual.lerp(alvo.set(mira.x * 0.75 * t.aspecto * 0.5, mira.y * 0.5), 0.06)
    } else {
      // Sem mouse (celular), a luz passeia sozinha de um lado para o outro
      luzAtual.lerp(alvo.set(Math.sin(tempo * 0.32 - 1.2) * 0.7, 0.18 + Math.cos(tempo * 0.21) * 0.22), 0.04)
    }
    corrida.position.set(luzAtual.x, luzAtual.y, 0.55)

    if (!opcoes.reduzido) {
      if (mexeu) alvo.set(mira.x * 0.14, -mira.y * 0.08)
      else alvo.set(Math.sin(tempo * 0.25) * 0.06, 0)
      giro.lerp(alvo, 0.05)
      grupo.rotation.y = giro.x
      grupo.rotation.x = giro.y + Math.sin(tempo * 0.4) * 0.012
    }

    renderer.render(cena, camera)
    if (!pronto) {
      pronto = true
      opcoes.aoPronto()
    }
    // Menos movimento: depois de acesa, a cena fica parada e não redesenha
    if (opcoes.reduzido && acender >= 1) return
    if (!pausado) raf = requestAnimationFrame(quadro)
  }
  raf = requestAnimationFrame(quadro)

  return {
    pausar(sim) {
      if (sim === pausado) return
      pausado = sim
      cancelAnimationFrame(raf)
      if (!sim) {
        ultimo = performance.now()
        raf = requestAnimationFrame(quadro)
      }
    },
    descartar() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', aoMover)
      geo.dispose()
      mat.dispose()
      ;[t.cor, t.altura, t.normal].forEach((x) => x.dispose())
      ambiente.dispose()
      pmrem.dispose()
      renderer.dispose()
    },
  }
}
