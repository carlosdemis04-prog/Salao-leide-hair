// Palco 3D compartilhado: um renderizador só, luz de estúdio e a peça que estiver em cena.
// Cada peça (secador e tesoura, unha, modelo dourada) é um objeto com grupo, atualização por quadro
// e ações que os botões da página chamam.
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

export type Peca = {
  grupo: THREE.Group
  // Chamada a cada quadro com o tempo em segundos desde o último
  atualizar: (dt: number, t: number) => void
  // Toque/clique numa malha da peça (nome da malha tocada)
  tocar?: (nome: string) => void
  // Arrastar em cima da peça (dx de -1 a 1 da largura) quando a peça quer o gesto para si
  arrastar?: (ponto: THREE.Vector3 | null) => boolean
  // Distância da câmera e altura do alvo
  enquadramento: { distancia: number; alvoY: number; fov?: number }
  descartar?: () => void
}

export type Palco = {
  mostrar: (peca: Peca) => void
  pausar: (sim: boolean) => void
  // Trava o giro num ângulo (para fotos de conferência); null solta
  fixarGiro: (angulo: number | null) => void
  descartar: () => void
  renderer: THREE.WebGLRenderer
}

export function criarPalco(canvas: HTMLCanvasElement, opcoes: { reduzido: boolean }): Palco {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap

  const cena = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const ambiente = pmrem.fromScene(new RoomEnvironment(), 0.03).texture
  cena.environment = ambiente
  cena.environmentIntensity = 0.9

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)

  // Luz principal quente do alto à esquerda, contraluz rosada e um preenchimento suave
  const principal = new THREE.DirectionalLight(0xfff1df, 2.2)
  principal.position.set(-3, 5, 4)
  principal.castShadow = true
  principal.shadow.mapSize.set(1024, 1024)
  principal.shadow.camera.left = -3
  principal.shadow.camera.right = 3
  principal.shadow.camera.top = 3
  principal.shadow.camera.bottom = -3
  principal.shadow.bias = -0.0005
  principal.shadow.radius = 6
  cena.add(principal)
  const contraluz = new THREE.DirectionalLight(0xffc9cf, 1.6)
  contraluz.position.set(4, 2.5, -4)
  cena.add(contraluz)
  cena.add(new THREE.HemisphereLight(0xfff8f0, 0xe9d6c4, 0.6))

  // Sombra suave no chão, só a sombra aparece (o chão é transparente)
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.16 }))
  chao.name = 'chao'
  chao.rotation.x = -Math.PI / 2
  chao.receiveShadow = true
  cena.add(chao)

  // A peça gira presa num pivô; arrastar gira, soltar deixa a inércia terminar
  const pivo = new THREE.Group()
  cena.add(pivo)
  let atual: Peca | null = null
  let rotY = 0
  let velY = 0
  let rotX = 0
  let arrastando = false
  let gestoDaPeca = false
  let ultimoX = 0
  let ultimoY = 0
  let moveu = 0
  let giroFixo: number | null = null

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
    rotX = THREE.MathUtils.clamp(rotX + dy * 0.004, -0.35, 0.35)
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
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)

  function ajustar() {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    enquadrar()
  }
  function enquadrar() {
    if (!atual) return
    const { distancia, alvoY, fov = 30 } = atual.enquadramento
    camera.fov = fov
    // Em tela estreita a câmera recua para a peça caber de lado a lado
    const recuo = camera.aspect < 1 ? 1 / Math.max(camera.aspect, 0.6) : 1
    camera.position.set(0, alvoY + distancia * 0.18, distancia * recuo)
    camera.lookAt(0, alvoY, 0)
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(ajustar)
  ro.observe(canvas)

  let pausado = false
  let ultimo = performance.now()
  let tempo = 0
  let entrada = 1
  function quadro(agora: number) {
    const dt = Math.min((agora - ultimo) / 1000, 0.05)
    ultimo = agora
    if (!pausado && atual) {
      tempo += dt
      if (!arrastando) {
        velY *= 0.94
        rotY += velY
        // Gira devagar sozinha quando ninguém mexe (menos movimento: fica parada)
        if (!opcoes.reduzido && Math.abs(velY) < 0.002) rotY += dt * 0.18
        rotX *= 0.96
      }
      if (giroFixo !== null) rotY = giroFixo
      pivo.rotation.y = rotY
      pivo.rotation.x = rotX
      // Entrada da peça: cresce de 0.85 a 1 com uma leve subida
      if (entrada < 1) {
        entrada = Math.min(1, entrada + dt * 1.6)
        const k = 1 - Math.pow(1 - entrada, 3)
        pivo.scale.setScalar(0.85 + 0.15 * k)
        pivo.position.y = (1 - k) * -0.2
      }
      atual.atualizar(dt, tempo)
      renderer.render(cena, camera)
    }
    raf = requestAnimationFrame(quadro)
  }
  let raf = requestAnimationFrame(quadro)

  return {
    renderer,
    mostrar(peca) {
      if (atual) {
        pivo.remove(atual.grupo)
        atual.descartar?.()
      }
      atual = peca
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
      pivo.scale.setScalar(opcoes.reduzido ? 1 : 0.85)
      ajustar()
    },
    fixarGiro(a) {
      giroFixo = a
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
      atual?.descartar?.()
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
