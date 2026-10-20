// A figura da logo em ouro de verdade: o desenho vira um relevo (cada mecha do cabelo ganha volume),
// a superfície é metal com reflexos de estúdio, e uma luz quente passa por cima seguindo o ponteiro.
// Tudo é feito a partir do próprio desenho da logo, no navegador, sem modelo baixado.
import * as THREE from 'three'

export type Relevo = {
  pausar: (sim: boolean) => void
  descartar: () => void
}

// Margem em volta da figura para ela poder inclinar sem cortar (o canvas é 12% maior que a imagem)
export const FOLGA = 1.12

// Desfoque de caixa separável, três passadas (fica perto de um gaussiano)
function desfocar(src: Float32Array, w: number, h: number, raio: number) {
  const a = src.slice()
  const b = new Float32Array(src.length)
  const r = Math.max(1, Math.round(raio))
  const k = 1 / (2 * r + 1)
  for (let passada = 0; passada < 3; passada++) {
    for (let y = 0; y < h; y++) {
      const o = y * w
      let soma = a[o] * (r + 1)
      for (let i = 1; i <= r; i++) soma += a[o + Math.min(i, w - 1)]
      for (let x = 0; x < w; x++) {
        b[o + x] = soma * k
        soma += a[o + Math.min(x + r + 1, w - 1)] - a[o + Math.max(x - r, 0)]
      }
    }
    for (let x = 0; x < w; x++) {
      let soma = b[x] * (r + 1)
      for (let i = 1; i <= r; i++) soma += b[Math.min(i, h - 1) * w + x]
      for (let y = 0; y < h; y++) {
        a[y * w + x] = soma * k
        soma += b[Math.min(y + r + 1, h - 1) * w + x] - b[Math.max(y - r, 0) * w + x]
      }
    }
  }
  return a
}

// Gera as texturas do relevo a partir do desenho: cor (com os sulcos escurecidos), altura e normais
async function texturasDaFigura(fonte: string, largura: number) {
  const img = new Image()
  img.src = fonte
  await img.decode()
  const w = largura
  const h = Math.round((largura * img.naturalHeight) / img.naturalWidth)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  const px = ctx.getImageData(0, 0, w, h).data

  const alfa = new Float32Array(w * h)
  const luz = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    // O desenho original tem um alfa suave (brilho); o relevo precisa de uma forma sólida
    const a = px[i * 4 + 3] / 255
    const k = Math.min(1, Math.max(0, (a - 0.22) / 0.3))
    alfa[i] = k * k * (3 - 2 * k)
    luz[i] = (px[i * 4] * 0.3 + px[i * 4 + 1] * 0.55 + px[i * 4 + 2] * 0.15) / 255
  }
  // Mechas finas ganham uma crista estreita; o rosto e o disco do cabelo ficam abaulados
  const fino = desfocar(alfa, w, h, w * 0.0035)
  const largo = desfocar(alfa, w, h, w * 0.014)
  // As formas grandes (o disco do cabelo, o rosto) ganham uma curvatura ampla, senão viram um espelho chapado
  const amplo = desfocar(alfa, w, h, w * 0.05)
  const altura = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) altura[i] = Math.min(1, fino[i] * 0.4 + Math.sqrt(Math.max(0, largo[i])) * 0.2 + amplo[i] * 0.4)
  // Onde a altura em volta é maior que a do ponto, é sulco: escurece um pouco
  const entorno = desfocar(altura, w, h, w * 0.01)

  const cor = new Uint8Array(w * h * 4)
  const alt = new Uint8Array(w * h * 4)
  const nor = new Uint8Array(w * h * 4)
  const H = (x: number, y: number) => altura[Math.min(Math.max(y, 0), h - 1) * w + Math.min(Math.max(x, 0), w - 1)]
  const forca = w / 260
  for (let y = 0; y < h; y++) {
    // As texturas do three.js começam de baixo; a imagem, de cima
    const linha = (h - 1 - y) * w
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const j = (linha + x) * 4
      // Ouro com a variação do desenho original (bem leve, quem faz o brilho é a luz),
      // escurecido no fundo dos sulcos entre as mechas
      const sulco = Math.min(1, Math.max(0, (entorno[i] - altura[i]) * 3.2))
      const v = (0.86 + (luz[i] - 0.6) * 0.35) * (1 - sulco * 0.6)
      cor[j] = Math.min(255, 226 * v)
      cor[j + 1] = Math.min(255, 176 * v)
      cor[j + 2] = Math.min(255, 84 * v)
      cor[j + 3] = alfa[i] * 255
      alt[j] = alt[j + 1] = alt[j + 2] = altura[i] * 255
      alt[j + 3] = 255
      const gx = (H(x + 1, y) - H(x - 1, y)) * forca
      const gy = (H(x, y - 1) - H(x, y + 1)) * forca
      const l = Math.hypot(gx, gy, 1)
      nor[j] = (-gx / l) * 127.5 + 127.5
      nor[j + 1] = (-gy / l) * 127.5 + 127.5
      nor[j + 2] = (1 / l) * 127.5 + 127.5
      nor[j + 3] = 255
    }
  }
  const tex = (d: Uint8Array, srgb = false) => {
    const t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat)
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.magFilter = THREE.LinearFilter
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.generateMipmaps = true
    t.anisotropy = 8
    t.needsUpdate = true
    return t
  }
  return { aspecto: w / h, cor: tex(cor, true), altura: tex(alt), normal: tex(nor) }
}

// Sala de reflexos própria do relevo: uma cúpula em degradê (clara e quente em cima, escura embaixo,
// sem emenda dura), uma caixa de luz no alto e faixas nas laterais para os chanfros brilharem.
// Tudo simétrico na frente e atrás, porque uma placa virada para a câmera reflete os dois lados
// dependendo de como inclina.
function salaDoRelevo() {
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
