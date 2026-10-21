// Palco 3D compartilhado: um estúdio escuro com luz de cinema, um pedestal preto com aro dourado
// e a peça que estiver em cena. A câmera entra com um travelling a cada troca e respira devagar parada.
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { estudio } from './estudio'

export type Peca = {
  grupo: THREE.Group
  // Chamada a cada quadro com o tempo em segundos desde o último
  atualizar: (dt: number, t: number) => void
  // Toque/clique numa malha da peça (nome da malha tocada)
  tocar?: (nome: string) => void
  // Arrastar em cima da peça, quando a peça quer o gesto para si
  arrastar?: (ponto: THREE.Vector3 | null) => boolean
  // Distância da câmera e altura do alvo
  enquadramento: { distancia: number; alvoY: number; fov?: number; elevacao?: number }
  descartar?: () => void
  // Chamada uma vez quando a peça entra em cena, para quem precisa do renderizador (mapas de reflexo próprios)
  preparar?: (renderer: THREE.WebGLRenderer) => void
}

export type Palco = {
  mostrar: (peca: Peca) => void
  pausar: (sim: boolean) => void
  // Trava o giro num ângulo (para fotos de conferência); null solta
  fixarGiro: (angulo: number | null) => void
  // Empurra a peça para a direita da tela (fração da largura), para o texto caber à esquerda
  deslocar: (fracao: number) => void
  descartar: () => void
  renderer: THREE.WebGLRenderer
}

const FUNDO = 0x0a0807

// Fundo infinito de estúdio: chão que curva e vira parede, para a luz fazer uma poça atrás da peça
function ciclorama() {
  const perfil: [number, number][] = []
  perfil.push([9, 0], [2, 0])
  for (let i = 1; i <= 16; i++) {
    const a = (i / 16) * (Math.PI / 2)
    perfil.push([-2 - Math.sin(a) * 4, 4 - Math.cos(a) * 4])
  }
  perfil.push([-6, 14])
  const pos: number[] = []
  const idx: number[] = []
  const L = 16
  perfil.forEach(([z, y]) => {
    pos.push(-L, y, z, L, y, z)
  })
  for (let i = 0; i < perfil.length - 1; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x1c1613, roughness: 0.92 }))
  m.name = 'ciclorama'
  m.receiveShadow = true
  return m
}

// Vinheta, grão de filme e o fade para preto das trocas
const Acabamento = {
  uniforms: {
    tDiffuse: { value: null },
    uTempo: { value: 0 },
    uEscuro: { value: 1 },
    uGrao: { value: 0.045 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTempo;
    uniform float uEscuro;
    uniform float uGrao;
    varying vec2 vUv;
    float ruido(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float vinheta = smoothstep(0.85, 0.25, length(d * vec2(1.15, 1.0)));
      c.rgb *= mix(0.55, 1.0, vinheta);
      c.rgb += (ruido(vUv * 900.0 + uTempo) - 0.5) * uGrao;
      c.rgb *= 1.0 - uEscuro;
      gl_FragColor = c;
    }
  `,
}

// Reflexo do tampo laqueado: a peça aparece de cabeça para baixo no preto, nítida no ponto de contato
// e cada vez mais borrada e apagada para a borda, como num tampo de verniz de verdade
const ReflexoTampo = {
  name: 'ReflexoTampo',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uRaio: { value: 1.3 },
    uForca: { value: 0.6 },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec2 vLocal;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vLocal = position.xy;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uRaio;
    uniform float uForca;
    varying vec4 vUv;
    varying vec2 vLocal;
    void main() {
      vec2 uv = vUv.xy / vUv.w;
      float r = length(vLocal) / uRaio;
      float borrao = mix(0.002, 0.016, smoothstep(0.0, 0.9, r));
      vec3 soma = texture2D(tDiffuse, uv).rgb * 0.2;
      for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.785398 + 0.39;
        vec2 o = vec2(cos(a), sin(a)) * borrao;
        soma += texture2D(tDiffuse, uv + o).rgb * 0.07;
        soma += texture2D(tDiffuse, uv + o * 0.45).rgb * 0.03;
      }
      float some = 1.0 - smoothstep(0.35, 1.0, r);
      gl_FragColor = vec4(soma * uForca * some, 1.0);
    }
  `,
}

export function criarPalco(canvas: HTMLCanvasElement, opcoes: { reduzido: boolean }): Palco {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  const celular = window.matchMedia('(pointer: coarse)').matches
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, celular ? 1.5 : 1.75))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.setClearColor(FUNDO)

  const cena = new THREE.Scene()
  cena.background = new THREE.Color(FUNDO)
  cena.fog = new THREE.Fog(FUNDO, 9, 22)
  const pmrem = new THREE.PMREMGenerator(renderer)
  const ambiente = pmrem.fromScene(estudio(), 0.02).texture
  cena.environment = ambiente
  cena.environmentIntensity = 1.25

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60)

  // Luz principal quente do alto, recorte dourado por trás, um toque rosado e a poça de luz no fundo
  const alvo = new THREE.Object3D()
  alvo.position.set(0, 0.9, 0)
  cena.add(alvo)
  const principal = new THREE.SpotLight(0xffe7c8, 170, 0, 0.5, 0.8, 2)
  principal.position.set(-3.2, 7.5, 4.2)
  principal.target = alvo
  principal.castShadow = true
  principal.shadow.mapSize.set(2048, 2048)
  principal.shadow.bias = -0.0004
  principal.shadow.radius = 5
  principal.shadow.camera.near = 4
  principal.shadow.camera.far = 16
  cena.add(principal)
  const recorte = new THREE.SpotLight(0xffb45a, 90, 0, 0.6, 0.7, 2)
  recorte.position.set(3.6, 4, -4.4)
  recorte.target = alvo
  cena.add(recorte)
  const rosado = new THREE.SpotLight(0xff9fb2, 40, 0, 0.6, 0.9, 2)
  rosado.position.set(-4.4, 2.4, -3)
  rosado.target = alvo
  cena.add(rosado)
  // O disco da logo vira luz: um círculo dourado projetado na parede atrás da peça
  const parede = new THREE.Object3D()
  parede.position.set(0, 2.4, -6)
  cena.add(parede)
  const disco = new THREE.SpotLight(0xd79a4c, 900, 0, 0.26, 0.5, 2)
  disco.position.set(0, 4.2, 3)
  disco.target = parede
  cena.add(disco)
  cena.add(new THREE.HemisphereLight(0xfff3e4, 0x140e0b, 0.12))

  const fundo = ciclorama()
  fundo.position.y = -0.14
  cena.add(fundo)

  // Pedestal preto laqueado com aro dourado; o topo fica na altura zero
  const pedestal = new THREE.Group()
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 1.42, 0.14, 128),
    new THREE.MeshStandardMaterial({ color: 0x060404, roughness: 0.5, envMapIntensity: 0.2 }),
  )
  base.position.y = -0.07
  base.receiveShadow = true
  base.castShadow = true
  pedestal.add(base)
  const aro = new THREE.Mesh(
    new THREE.TorusGeometry(1.352, 0.012, 12, 160),
    new THREE.MeshPhysicalMaterial({ color: 0xe2b04e, metalness: 1, roughness: 0.18 }),
  )
  aro.rotation.x = Math.PI / 2
  aro.position.y = -0.002
  pedestal.add(aro)
  // O reflexo é somado por cima do verniz, então a sombra da peça no tampo continua aparecendo
  const qualidadeReflexo = celular ? 0.4 : 0.6
  const tampo = new Reflector(new THREE.CircleGeometry(1.34, 96), {
    shader: ReflexoTampo,
    textureWidth: 512,
    textureHeight: 512,
    clipBias: 0.002,
  })
  const tampoMat = tampo.material as THREE.ShaderMaterial
  tampoMat.transparent = true
  tampoMat.blending = THREE.AdditiveBlending
  tampoMat.depthWrite = false
  tampo.rotation.x = -Math.PI / 2
  tampo.position.y = 0.001
  pedestal.add(tampo)
  cena.add(pedestal)

  // Pós: brilho suave nos realces do dourado, conversão de cor e o acabamento de filme
  // Bordas sem serrilhado: o compositor desenha com multiamostragem no computador
  const alvoPos = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: celular ? 0 : 4 })
  const composer = new EffectComposer(renderer, alvoPos)
  composer.addPass(new RenderPass(cena, camera))
  const brilho = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.28, 0.5, 0.9)
  composer.addPass(brilho)
  composer.addPass(new OutputPass())
  const acabamento = new ShaderPass(Acabamento)
  composer.addPass(acabamento)

  // A peça gira presa num pivô; arrastar gira, soltar deixa a inércia terminar
  const pivo = new THREE.Group()
  cena.add(pivo)
  let atual: Peca | null = null
  let proxima: Peca | null = null
  let rotY = 0
  let velY = 0
  let rotX = 0
  let arrastando = false
  let gestoDaPeca = false
  let ultimoX = 0
  let ultimoY = 0
  let moveu = 0
  let giroFixo: number | null = null
  let deslocamento = 0
  const mira = new THREE.Vector2()
  const miraSuave = new THREE.Vector2()

  const raycaster = new THREE.Raycaster()
  const ponteiro = new THREE.Vector2()

  function acertar(e: PointerEvent) {
    const r = canvas.getBoundingClientRect()
    ponteiro.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    raycaster.setFromCamera(ponteiro, camera)
    return atual ? raycaster.intersectObject(atual.grupo, true)[0] : undefined
  }

  function onDown(e: PointerEvent) {
    arrastando = true
    moveu = 0
    ultimoX = e.clientX
    ultimoY = e.clientY
    const hit = acertar(e)
    gestoDaPeca = !!(hit && atual?.arrastar?.(hit.point))
    canvas.setPointerCapture(e.pointerId)
  }
  function onMove(e: PointerEvent) {
    const r = canvas.getBoundingClientRect()
    mira.set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1)
    if (!arrastando) {
      const hit = acertar(e)
      canvas.style.cursor = hit ? 'pointer' : 'grab'
      return
    }
    const dx = e.clientX - ultimoX
    const dy = e.clientY - ultimoY
    moveu += Math.abs(dx) + Math.abs(dy)
    ultimoX = e.clientX
    ultimoY = e.clientY
    if (gestoDaPeca) {
      const hit = acertar(e)
      atual?.arrastar?.(hit ? hit.point : null)
      return
    }
    velY = dx * 0.012
    rotY += velY
    rotX = THREE.MathUtils.clamp(rotX + dy * 0.003, -0.25, 0.25)
  }
  function onUp(e: PointerEvent) {
    if (arrastando && moveu < 6) {
      const hit = acertar(e)
      if (hit) atual?.tocar?.(nomeDaParte(hit.object))
    }
    if (gestoDaPeca) atual?.arrastar?.(null)
    arrastando = false
    gestoDaPeca = false
  }
  function onLeave() {
    mira.set(0, 0)
  }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)
  canvas.addEventListener('pointerleave', onLeave)

  let largura = 1
  let altura = 1
  function ajustar() {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (!w || !h) return
    largura = w
    altura = h
    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    const dpr = renderer.getPixelRatio()
    tampo.getRenderTarget().setSize(Math.round(w * dpr * qualidadeReflexo), Math.round(h * dpr * qualidadeReflexo))
    camera.aspect = w / h
    aplicarDeslocamento()
  }
  function aplicarDeslocamento() {
    if (deslocamento) camera.setViewOffset(largura, altura, -largura * deslocamento, 0, largura, altura)
    else camera.clearViewOffset()
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(ajustar)
  ro.observe(canvas)

  // Travelling de entrada: começa aberto, mais baixo e de lado, e chega no enquadramento final
  let entrada = 1
  const posCamera = new THREE.Vector3()
  const alvoCamera = new THREE.Vector3()
  function colocarCamera(t: number) {
    if (!atual) return
    const { distancia, alvoY, fov = 28, elevacao = 0.14 } = atual.enquadramento
    if (camera.fov !== fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    // Em tela estreita a câmera recua para a peça caber de lado a lado
    const recuo = camera.aspect < 1 ? 1 / Math.max(camera.aspect, 0.8) : 1
    const k = 1 - Math.pow(1 - entrada, 4)
    const d = distancia * recuo * THREE.MathUtils.lerp(1.5, 1, k)
    const az = THREE.MathUtils.lerp(0.55, 0, k)
    const respira = opcoes.reduzido ? 0 : 1
    miraSuave.lerp(mira, 0.04)
    const px = (Math.sin(t * 0.31) * 0.06 + miraSuave.x * 0.28) * respira
    const py = (Math.sin(t * 0.23) * 0.04 - miraSuave.y * 0.16) * respira
    const y = alvoY + distancia * elevacao + THREE.MathUtils.lerp(-0.5, 0, k) + py
    posCamera.set(Math.sin(az) * d + px, y, Math.cos(az) * d)
    alvoCamera.set(px * 0.3, alvoY + py * 0.3, 0)
    camera.position.copy(posCamera)
    camera.lookAt(alvoCamera)
  }

  let pausado = false
  let ultimo = performance.now()
  let tempo = 0
  let escuro = 1
  function quadro(agora: number) {
    const dt = Math.min((agora - ultimo) / 1000, 0.05)
    // Cortes e travelling seguem o relógio: num aparelho lento eles não se arrastam
    const dtCorte = Math.min((agora - ultimo) / 1000, 0.25)
    ultimo = agora
    if (!pausado) {
      tempo += dt
      // Corte para preto, troca a peça e volta
      if (proxima) {
        escuro = Math.min(1, escuro + dtCorte * (opcoes.reduzido ? 100 : 3.2))
        if (escuro >= 1) trocar(proxima)
      } else escuro = Math.max(0, escuro - dtCorte * (opcoes.reduzido ? 100 : 1.6))
      acabamento.uniforms.uEscuro.value = escuro
      acabamento.uniforms.uTempo.value = tempo % 100
      if (atual) {
        if (!arrastando) {
          velY *= 0.94
          rotY += velY
          // Gira devagar sozinha quando ninguém mexe (menos movimento: fica parada)
          if (!opcoes.reduzido && Math.abs(velY) < 0.002) rotY += dt * 0.12
          rotX *= 0.96
        }
        if (giroFixo !== null) rotY = giroFixo
        pivo.rotation.y = rotY
        pivo.rotation.x = rotX
        if (entrada < 1) entrada = Math.min(1, entrada + dtCorte / 2.6)
        colocarCamera(tempo)
        atual.atualizar(dt, tempo)
      }
      composer.render(dt)
    }
    raf = requestAnimationFrame(quadro)
  }
  let raf = requestAnimationFrame(quadro)

  function trocar(peca: Peca) {
    proxima = null
    if (atual) {
      pivo.remove(atual.grupo)
      atual.descartar?.()
    }
    atual = peca
    peca.preparar?.(renderer)
    peca.grupo.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    pivo.add(peca.grupo)
    rotY = -0.5
    velY = 0
    entrada = opcoes.reduzido ? 1 : 0
    ajustar()
    colocarCamera(tempo)
  }

  return {
    renderer,
    mostrar(peca) {
      if (!atual) {
        trocar(peca)
        return
      }
      // A peça que estava esperando a troca nunca chegou a aparecer
      if (proxima && proxima !== peca) proxima.descartar?.()
      proxima = peca
    },
    fixarGiro(a) {
      giroFixo = a
    },
    deslocar(f) {
      deslocamento = f
      aplicarDeslocamento()
    },
    pausar(sim) {
      pausado = sim
      ultimo = performance.now()
    },
    descartar() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('pointerleave', onLeave)
      atual?.descartar?.()
      proxima?.descartar?.()
      cena.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh) {
          m.geometry.dispose()
          ;(Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose())
        }
      })
      composer.dispose()
      tampo.dispose()
      ambiente.dispose()
      pmrem.dispose()
      renderer.dispose()
    },
  }
}

// Sobe na hierarquia até a primeira parte com nome (detalhes de superfície pertencem à parte)
function nomeDaParte(o: THREE.Object3D): string {
  let n: THREE.Object3D | null = o
  while (n && (!n.name || n.userData.explodeWithParent)) n = n.parent
  return n?.name ?? ''
}
