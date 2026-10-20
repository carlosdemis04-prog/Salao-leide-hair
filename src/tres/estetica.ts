// Cena da estética: uma estatueta dourada no estilo da logo, com o cabelo longo esvoaçando para trás.
// Tocar troca a pose; o cabelo balança sozinho e dá um sacudida a cada troca.
import * as THREE from 'three'
import { liberar, malha, ouro, plastico, torno, varredura } from './formas'
import type { Peca } from './palco'

type V = [number, number, number]
// Cada braço é dado por três direções no referencial do tronco: braço, antebraço e mão
type Braco = { braco: V; antebraco: V; mao: V }
type Pose = { nome: string; direito: Braco; esquerdo: Braco; tronco: number; quadril: number; cabeca: [number, number] }

const espelho = (b: Braco): Braco => ({
  braco: [-b.braco[0], b.braco[1], b.braco[2]],
  antebraco: [-b.antebraco[0], b.antebraco[1], b.antebraco[2]],
  mao: [-b.mao[0], b.mao[1], b.mao[2]],
})
const naNuca: Braco = { braco: [0.55, 0.8, -0.1], antebraco: [-0.85, 0.35, -0.35], mao: [-0.6, -0.2, -0.5] }
const naCintura: Braco = { braco: [0.55, -0.75, -0.2], antebraco: [-0.86, -0.4, 0.4], mao: [-0.3, -0.9, 0.3] }
const paraCima: Braco = { braco: [0.6, 0.75, 0.15], antebraco: [0.35, 0.9, 0.12], mao: [0.15, 0.95, 0.05] }

export const POSES: Pose[] = [
  // Uma mão erguendo o cabelo na nuca, a outra na cintura, rosto de perfil como na logo
  { nome: 'Clássica', direito: naNuca, esquerdo: espelho(naCintura), tronco: 0.25, quadril: 0.05, cabeca: [-0.85, -0.1] },
  // Braços abertos para o alto, cabeça erguida
  { nome: 'Aberta', direito: paraCima, esquerdo: espelho(paraCima), tronco: 0, quadril: 0, cabeca: [0.15, 0.18] },
  // As duas mãos na cintura, ombros para trás
  { nome: 'Cintura', direito: naCintura, esquerdo: espelho(naCintura), tronco: -0.2, quadril: -0.06, cabeca: [-0.55, 0.05] },
]

// Cabeça: elipsoide com nariz, queixo e mandíbula afinada, olhando para +Z
function cabecaGeo() {
  const g = new THREE.SphereGeometry(0.1, 48, 36)
  const p = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const ny = v.y / 0.1
    let x = v.x * 0.8
    let y = v.y * 1.18
    let z = v.z * 0.98
    if (ny < 0) {
      // Mandíbula e queixo afinam embaixo
      const k = Math.pow(-ny, 1.6)
      x *= 1 - 0.4 * k
      z *= 1 - (z < 0 ? 0.45 : 0.15) * k
    }
    if (z > 0) {
      const fx = x * x
      // Nariz
      z += 0.03 * Math.exp(-((ny + 0.14) ** 2) / 0.018 - fx / 0.0005)
      // Lábios
      z += 0.008 * Math.exp(-((ny + 0.5) ** 2) / 0.006 - fx / 0.0009)
      // Queixo
      z += 0.012 * Math.exp(-((ny + 0.78) ** 2) / 0.015 - fx / 0.0012)
      // Leve cavidade dos olhos
      z -= 0.008 * Math.exp(-((ny - 0.12) ** 2) / 0.01 - (Math.abs(x) - 0.035) ** 2 / 0.0004)
    }
    p.setXYZ(i, x, y, z)
  }
  g.computeVertexNormals()
  return g
}

// Saia sereia com pregas verticais, do quadril ao chão
function saiaGeo() {
  const g = torno(
    [
      [0.001, 1.2],
      [0.14, 1.19],
      [0.19, 1.08],
      [0.2, 0.95],
      [0.165, 0.68],
      [0.17, 0.5],
      [0.25, 0.36],
      [0.4, 0.27],
      [0.42, 0.25],
    ],
    96,
  )
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    const r = Math.hypot(x, z)
    if (r < 0.01) continue
    const a = Math.atan2(z, x)
    // As pregas aparecem do joelho para baixo
    const k = THREE.MathUtils.smoothstep(0.75 - y, 0, 0.45)
    const nr = r + Math.sin(a * 14) * 0.012 * k
    p.setXYZ(i, (x / r) * nr, y, (z / r) * nr)
  }
  g.computeVertexNormals()
  return g
}

// Braço numa varredura só (ombro, cotovelo, pulso e mão), refeita quando a pose muda
const RAIOS = [0.052, 0.046, 0.039, 0.032, 0.029, 0.02, 0.027, 0.006]
function bracoGeo(ombro: THREE.Vector3, b: Braco, lado: number) {
  const dir = (v: V) => new THREE.Vector3(...v).normalize()
  const cot = ombro.clone().addScaledVector(dir(b.braco), 0.3)
  const pulso = cot.clone().addScaledVector(dir(b.antebraco), 0.26)
  const mao = pulso.clone().addScaledVector(dir(b.mao), 0.05)
  const ponta = pulso.clone().addScaledVector(dir(b.mao), 0.11)
  // Começa por dentro do ombro para emendar no tronco sem degrau
  const dentro = ombro.clone().add(new THREE.Vector3(-0.06 * lado, -0.03, 0))
  const pts = [dentro, ombro, ombro.clone().lerp(cot, 0.5), cot, cot.clone().lerp(pulso, 0.5), pulso, mao, ponta]
  const acum = [0]
  for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1] + pts[i].distanceTo(pts[i - 1]))
  const total = acum[acum.length - 1]
  const raio = (t: number) => {
    const d = t * total
    let i = 1
    while (i < acum.length - 1 && acum[i] < d) i++
    const f = (d - acum[i - 1]) / Math.max(acum[i] - acum[i - 1], 1e-6)
    return THREE.MathUtils.lerp(RAIOS[i - 1], RAIOS[i], THREE.MathUtils.clamp(f, 0, 1))
  }
  return varredura(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), raio, { passos: 56, lados: 14, achatar: 0.86 })
}

// Gerador determinístico para o cabelo sair sempre igual
function sorteio(semente: number) {
  let s = semente
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export function criarEstetica(reduzido: boolean, aoMudar: (pose: number) => void = () => {}): Peca & { mudarPose: (i?: number) => number; poseAtual: () => number } {
  const grupo = new THREE.Group()
  const brilho = ouro(0.2)
  const fosco = ouro(0.34)
  const cabeloMat = ouro(0.26)

  // Pedestal de marfim com aro dourado
  const pedestal = new THREE.Group()
  pedestal.name = 'pedestal'
  pedestal.add(
    malha(
      'pedestal-base',
      torno(
        [
          [0.001, 0],
          [0.6, 0],
          [0.62, 0.03],
          [0.6, 0.06],
          [0.52, 0.09],
          [0.5, 0.2],
          [0.54, 0.23],
          [0.001, 0.25],
        ],
        64,
        false,
      ),
      plastico(0xe4d6c3, 0.35),
    ),
  )
  const aro = malha('pedestal-aro', new THREE.TorusGeometry(0.51, 0.014, 12, 96), brilho)
  aro.userData.explodeWithParent = true
  aro.rotation.x = Math.PI / 2
  aro.position.y = 0.17
  pedestal.add(aro)
  grupo.add(pedestal)

  const corpo = new THREE.Group()
  corpo.name = 'modelo'
  grupo.add(corpo)

  // Quadril e saia; o tronco gira em cima dele
  const quadril = new THREE.Group()
  quadril.position.y = 0.25
  corpo.add(quadril)
  const saia = malha('saia', saiaGeo(), fosco)
  saia.scale.z = 0.82
  saia.position.y = -0.25
  quadril.add(saia)

  const tronco = new THREE.Group()
  tronco.position.y = 1.18 - 0.25
  quadril.add(tronco)
  const torso = malha(
    'tronco',
    torno([
      [0.14, -0.02],
      [0.118, 0.05],
      [0.13, 0.17],
      [0.158, 0.25],
      [0.152, 0.31],
      [0.158, 0.355],
      [0.13, 0.405],
      [0.072, 0.445],
      [0.046, 0.49],
      [0.04, 0.58],
      [0.001, 0.6],
    ]),
    brilho,
  )
  torso.scale.z = 0.66
  tronco.add(torso)
  // Cinto fino dourado polido na cintura
  const cinto = malha('cinto', new THREE.TorusGeometry(0.122, 0.012, 10, 64), ouro(0.12))
  cinto.userData.explodeWithParent = true
  cinto.rotation.x = Math.PI / 2
  cinto.scale.y = 0.68
  cinto.position.y = 0.05
  tronco.add(cinto)

  // Braços presos no tronco, no referencial dele
  const ombroD = new THREE.Vector3(0.175, 0.37, -0.005)
  const ombroE = new THREE.Vector3(-0.175, 0.37, -0.005)
  const bracoD = malha('braco-direito', new THREE.BufferGeometry(), brilho)
  const bracoE = malha('braco-esquerdo', new THREE.BufferGeometry(), brilho)
  tronco.add(bracoD, bracoE)

  const cabeca = new THREE.Group()
  cabeca.name = 'cabeca'
  cabeca.position.y = 0.655
  cabeca.scale.setScalar(0.92)
  tronco.add(cabeca)
  const rosto = malha('rosto', cabecaGeo(), brilho)
  cabeca.add(rosto)

  // Volume do cabelo cobrindo o alto e a nuca, deixando o rosto livre
  const touca = malha('cabelo-touca', new THREE.SphereGeometry(0.112, 40, 24, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, 2.1), cabeloMat)
  touca.scale.set(0.86, 1.14, 1.06)
  touca.position.set(0, 0.012, -0.008)
  cabeca.add(touca)

  // Volume redondo atrás da cabeça, como o disco de cabelo da logo
  const volume = malha('cabelo-volume', new THREE.SphereGeometry(0.13, 40, 28), cabeloMat)
  volume.userData.explodeWithParent = true
  volume.scale.set(0.95, 1.0, 1.35)
  volume.position.set(0, 0.03, -0.1)
  cabeca.add(volume)

  // Mechas: saem do volume, caem para trás em ondas largas e terminam num cacho
  const mechas: { m: THREE.Mesh; fase: number; peso: number }[] = []
  const rnd = sorteio(7)
  const N = 24
  for (let k = 0; k < N; k++) {
    const lado = (k / (N - 1)) * 2 - 1
    const raiz = new THREE.Vector3(lado * 0.1, 0.06 - Math.abs(lado) * 0.05 + (rnd() - 0.5) * 0.06, -0.16 - rnd() * 0.04)
    const L = 0.5 + rnd() * 0.5 - Math.abs(lado) * 0.15
    const fase = rnd() * Math.PI * 2
    const onda = 0.035 + rnd() * 0.03
    const pts: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0.08)]
    for (let i = 0; i <= 9; i++) {
      const s = i / 9
      const atras = -L * 0.9 * s
      const desce = -L * 0.75 * Math.pow(s, 1.5) + 0.04 * Math.sin(s * Math.PI)
      const abre = lado * 0.18 * s + Math.sin(s * 7 + fase) * onda * s
      pts.push(new THREE.Vector3(abre, desce, atras))
    }
    // Cacho na ponta, enrolando para cima e para dentro
    const fim = pts[pts.length - 1]
    const giro = lado >= 0 ? 1 : -1
    for (let i = 1; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 1.5
      const r = 0.06 * (1 - i / 8)
      pts.push(new THREE.Vector3(fim.x + Math.sin(a) * r * 0.5 * giro, fim.y + (1 - Math.cos(a)) * r, fim.z - Math.sin(a) * r))
    }
    const curva = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
    const grossa = 0.055 + rnd() * 0.03
    const g = varredura(curva, (t) => grossa * Math.pow(1 - t, 0.8) + 0.002, { passos: 72, lados: 12, achatar: 0.3 })
    const m = malha(`cabelo-mecha-${k}`, g, cabeloMat)
    m.userData.explodeWithParent = true
    m.position.copy(raiz)
    cabeca.add(m)
    mechas.push({ m, fase, peso: 0.6 + rnd() * 0.6 })
  }
  // A cabeça agrupa rosto e cabelo para o toque ler "cabeca"
  rosto.userData.explodeWithParent = true
  touca.userData.explodeWithParent = true

  // Estado da pose: valores atuais interpolando para a pose pedida
  let indice = 0
  let de = POSES[0]
  let para = POSES[0]
  let k = 1
  let sacudida = 0

  function aplicar(a: Pose, b: Pose, e: number) {
    const l = THREE.MathUtils.lerp
    const mix = (x: V, y: V): V => [l(x[0], y[0], e), l(x[1], y[1], e), l(x[2], y[2], e)]
    const braco = (ba: Braco, bb: Braco): Braco => ({ braco: mix(ba.braco, bb.braco), antebraco: mix(ba.antebraco, bb.antebraco), mao: mix(ba.mao, bb.mao) })
    bracoD.geometry.dispose()
    bracoD.geometry = bracoGeo(ombroD, braco(a.direito, b.direito), 1)
    bracoE.geometry.dispose()
    bracoE.geometry = bracoGeo(ombroE, braco(a.esquerdo, b.esquerdo), -1)
    tronco.rotation.y = l(a.tronco, b.tronco, e)
    quadril.rotation.z = l(a.quadril, b.quadril, e)
    cabeca.rotation.y = l(a.cabeca[0], b.cabeca[0], e)
    cabeca.rotation.x = -l(a.cabeca[1], b.cabeca[1], e)
  }
  aplicar(de, para, 1)

  function mudarPose(i?: number) {
    const proximo = i ?? (indice + 1) % POSES.length
    // Parte de onde está, mesmo no meio de uma transição
    const e = suave(k)
    const l = THREE.MathUtils.lerp
    const mix = (x: V, y: V): V => [l(x[0], y[0], e), l(x[1], y[1], e), l(x[2], y[2], e)]
    const braco = (ba: Braco, bb: Braco): Braco => ({ braco: mix(ba.braco, bb.braco), antebraco: mix(ba.antebraco, bb.antebraco), mao: mix(ba.mao, bb.mao) })
    de = {
      nome: '',
      direito: braco(de.direito, para.direito),
      esquerdo: braco(de.esquerdo, para.esquerdo),
      tronco: l(de.tronco, para.tronco, e),
      quadril: l(de.quadril, para.quadril, e),
      cabeca: [l(de.cabeca[0], para.cabeca[0], e), l(de.cabeca[1], para.cabeca[1], e)],
    }
    para = POSES[proximo]
    indice = proximo
    k = reduzido ? 1 : 0
    if (reduzido) aplicar(de, para, 1)
    sacudida = 1
    aoMudar(indice)
    return indice
  }

  return {
    grupo,
    enquadramento: { distancia: 6.1, alvoY: 1.2 },
    mudarPose,
    poseAtual: () => indice,
    tocar: () => mudarPose(),
    atualizar(dt, t) {
      if (k < 1) {
        k = Math.min(1, k + dt / 0.9)
        aplicar(de, para, suave(k))
      }
      sacudida = Math.max(0, sacudida - dt * 0.8)
      if (reduzido) return
      // Vento leve no cabelo; a troca de pose dá um impulso que vai sumindo
      const forca = 0.05 + sacudida * 0.16
      for (const { m, fase, peso } of mechas) {
        m.rotation.x = Math.sin(t * 1.4 + fase) * forca * peso + sacudida * 0.12
        m.rotation.y = Math.sin(t * 0.9 + fase * 1.3) * forca * 0.6
      }
      corpo.position.y = Math.sin(t * 0.7) * 0.008
    },
    descartar: () => liberar(grupo),
  }
}

function suave(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}
