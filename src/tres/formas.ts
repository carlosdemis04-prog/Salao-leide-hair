// Ferramentas de modelagem usadas pelas peças: varredura afinada (mechas de cabelo, cerdas, cabos),
// torno (corpos redondos) e os materiais da paleta.
import * as THREE from 'three'
import { microtexturas } from './texturas'

// Varre uma seção elíptica ao longo de uma curva, afinando conforme raio(t).
// Os quadros usam transporte paralelo para a seção não virar 180° numa inflexão da curva.
export function varredura(
  curva: THREE.Curve<THREE.Vector3>,
  raio: (t: number) => number,
  opcoes: { passos?: number; lados?: number; achatar?: number; pontaFechada?: boolean } = {},
) {
  const { passos = 48, lados = 12, achatar = 1, pontaFechada = true } = opcoes
  const pts = curva.getSpacedPoints(passos)
  const tangentes = pts.map((_, i) => curva.getTangentAt(i / passos).normalize())
  // Normal inicial perpendicular à primeira tangente
  const normais: THREE.Vector3[] = []
  const t0 = tangentes[0]
  const aux = Math.abs(t0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
  normais[0] = new THREE.Vector3().crossVectors(t0, aux).normalize()
  for (let i = 1; i <= passos; i++) {
    const eixo = new THREE.Vector3().crossVectors(tangentes[i - 1], tangentes[i])
    const n = normais[i - 1].clone()
    if (eixo.lengthSq() > 1e-10) {
      eixo.normalize()
      const ang = Math.acos(THREE.MathUtils.clamp(tangentes[i - 1].dot(tangentes[i]), -1, 1))
      n.applyAxisAngle(eixo, ang)
    }
    normais[i] = n
  }

  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= passos; i++) {
    const t = i / passos
    const r = Math.max(raio(t), 0.0004)
    const b = new THREE.Vector3().crossVectors(tangentes[i], normais[i])
    for (let j = 0; j <= lados; j++) {
      const a = (j / lados) * Math.PI * 2
      const p = pts[i]
        .clone()
        .addScaledVector(normais[i], Math.cos(a) * r)
        .addScaledVector(b, Math.sin(a) * r * achatar)
      pos.push(p.x, p.y, p.z)
      uv.push(j / lados, t)
    }
  }
  for (let i = 0; i < passos; i++) {
    for (let j = 0; j < lados; j++) {
      const a = i * (lados + 1) + j
      const b2 = a + lados + 1
      idx.push(a, b2, a + 1, b2, b2 + 1, a + 1)
    }
  }
  // Tampa nas pontas para a malha ser fechada
  const tampa = (i: number, inverter: boolean) => {
    const c = pts[i]
    const ci = pos.length / 3
    pos.push(c.x, c.y, c.z)
    uv.push(0.5, i / passos)
    for (let j = 0; j < lados; j++) {
      const a = i * (lados + 1) + j
      if (inverter) idx.push(ci, a + 1, a)
      else idx.push(ci, a, a + 1)
    }
  }
  tampa(0, false)
  if (pontaFechada) tampa(passos, true)

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// Torno a partir de pares [raio, altura]; suaviza o perfil com uma spline
export function torno(perfil: [number, number][], segmentos = 48, suavizar = true) {
  let pts = perfil.map(([r, y]) => new THREE.Vector2(r, y))
  if (suavizar) {
    const c = new THREE.SplineCurve(pts)
    pts = c.getPoints(perfil.length * 8)
  }
  const g = new THREE.LatheGeometry(pts, segmentos)
  g.computeVertexNormals()
  return g
}

export const CORES = {
  ouro: 0xe2b04e,
  ouroEscuro: 0xb98a2e,
  marfim: 0xf6efe6,
  rosa: 0xf2c4c6,
  rosaForte: 0xc7536a,
  champanhe: 0xead6b0,
  cafe: 0x2b211c,
  aco: 0xd9dde2,
}

// Ouro com microrrelevo: o reflexo se quebra um pouco, como em metal polido à mão
export function ouro(rugosidade = 0.24) {
  const t = microtexturas()
  return new THREE.MeshPhysicalMaterial({
    color: CORES.ouro,
    metalness: 1,
    roughness: rugosidade,
    roughnessMap: t.rugosidade,
    normalMap: t.metal,
    normalScale: new THREE.Vector2(0.1, 0.1),
    clearcoat: 0.4,
    clearcoatRoughness: 0.2,
  })
}

// Plástico laqueado com a "casca de laranja" bem leve da pintura
export function plastico(cor: number, rugosidade = 0.32) {
  const t = microtexturas()
  return new THREE.MeshPhysicalMaterial({
    color: cor,
    roughness: rugosidade,
    roughnessMap: t.rugosidade,
    normalMap: t.metal,
    normalScale: new THREE.Vector2(0.08, 0.08),
    clearcoat: 0.6,
    clearcoatRoughness: 0.18,
  })
}

// Aço escovado: o brilho se estica na direção dos riscos
export function metal(cor = CORES.aco, rugosidade = 0.22) {
  const t = microtexturas()
  return new THREE.MeshPhysicalMaterial({
    color: cor,
    metalness: 1,
    roughness: rugosidade,
    normalMap: t.escovado,
    normalScale: new THREE.Vector2(0.25, 0.25),
    anisotropy: 0.6,
    envMapIntensity: 2.2,
  })
}

export function malha(nome: string, g: THREE.BufferGeometry, m: THREE.Material) {
  const x = new THREE.Mesh(g, m)
  x.name = nome
  return x
}

// Libera geometrias e materiais de uma peça ao trocar de cena
export function liberar(grupo: THREE.Object3D) {
  grupo.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.geometry.dispose()
    const mats = Array.isArray(m.material) ? m.material : [m.material]
    mats.forEach((x) => {
      // Texturas também (as compartilhadas voltam para a placa de vídeo sozinhas se forem usadas de novo)
      Object.values(x).forEach((v) => (v as THREE.Texture | null)?.isTexture && (v as THREE.Texture).dispose())
      x.dispose()
    })
  })
}

// Superelipse: n=2 é círculo; n maior vai virando um retângulo de cantos redondos
function superelipse(a: number, l: number, n: number) {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [l * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), Math.sign(s) * Math.pow(Math.abs(s), 2 / n)]
}

// Varredura com seção de superelipse que muda ao longo da curva: largura, altura e quão quadrada é.
// Serve para cabos, bicos e alças, que nunca são tubos redondos de verdade.
export function perfilado(
  curva: THREE.Curve<THREE.Vector3>,
  secao: (t: number) => { largura: number; altura: number; n?: number },
  opcoes: { passos?: number; lados?: number; tampas?: boolean; cima?: THREE.Vector3 } = {},
) {
  const { passos = 64, lados = 48, tampas = true, cima = new THREE.Vector3(0, 0, 1) } = opcoes
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const p = new THREE.Vector3()
  const tg = new THREE.Vector3()
  const nx = new THREE.Vector3()
  const ny = new THREE.Vector3()
  const centros: THREE.Vector3[] = []
  for (let i = 0; i <= passos; i++) {
    const t = i / passos
    curva.getPointAt(t, p)
    curva.getTangentAt(t, tg).normalize()
    // "cima" fixo dá quadros estáveis para curvas planas (que é o caso de todas as peças)
    nx.crossVectors(cima, tg).normalize()
    ny.crossVectors(tg, nx).normalize()
    const { largura, altura, n = 2 } = secao(t)
    centros.push(p.clone())
    for (let j = 0; j <= lados; j++) {
      const a = (j / lados) * Math.PI * 2
      const [x, y] = superelipse(a, 1, n)
      pos.push(p.x + nx.x * x * largura + ny.x * y * altura, p.y + nx.y * x * largura + ny.y * y * altura, p.z + nx.z * x * largura + ny.z * y * altura)
      uv.push(j / lados, t)
    }
  }
  for (let i = 0; i < passos; i++)
    for (let j = 0; j < lados; j++) {
      const a = i * (lados + 1) + j
      const b = a + lados + 1
      idx.push(a, a + 1, b, b, a + 1, b + 1)
    }
  if (tampas) {
    ;[0, passos].forEach((i, k) => {
      const c = pos.length / 3
      pos.push(centros[i].x, centros[i].y, centros[i].z)
      uv.push(0.5, k)
      for (let j = 0; j < lados; j++) {
        const a = i * (lados + 1) + j
        if (k === 0) idx.push(c, a + 1, a)
        else idx.push(c, a, a + 1)
      }
    })
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// Torno com seção de superelipse: frascos de cantos arredondados em vez de garrafas redondas
export function tornoQuadrado(perfil: [number, number][], n: number, segmentos = 96, suavizar = true) {
  let pts = perfil.map(([r, y]) => new THREE.Vector2(r, y))
  if (suavizar) pts = new THREE.SplineCurve(pts).getPoints(perfil.length * 10)
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  pts.forEach((pt, i) => {
    for (let j = 0; j <= segmentos; j++) {
      const a = (j / segmentos) * Math.PI * 2
      const [x, z] = superelipse(a, 1, n)
      pos.push(x * pt.x, pt.y, -z * pt.x)
      uv.push(j / segmentos, i / (pts.length - 1))
    }
  })
  for (let i = 0; i < pts.length - 1; i++)
    for (let j = 0; j < segmentos; j++) {
      const a = i * (segmentos + 1) + j
      const b = a + segmentos + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// Pintura metálica de carro: base com flocos (metal parcial) e verniz grosso por cima
export function pinturaMetalica(cor: number, rugosidade = 0.38) {
  return new THREE.MeshPhysicalMaterial({
    color: cor,
    metalness: 0.8,
    roughness: rugosidade,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
  })
}

// Plástico emborrachado (soft touch): fosco, sem verniz, com um veludo leve nas bordas
export function emborrachado(cor = 0x0d0c0c) {
  const t = microtexturas()
  return new THREE.MeshPhysicalMaterial({
    color: cor,
    roughness: 0.62,
    roughnessMap: t.rugosidade,
    normalMap: t.metal,
    normalScale: new THREE.Vector2(0.05, 0.05),
    sheen: 0.4,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0x6b5a4a),
  })
}

// Vidro grosso de perfumaria
export function vidro(espessura = 0.5) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.03,
    transmission: 1,
    thickness: espessura,
    ior: 1.5,
    attenuationColor: new THREE.Color(0xf2efe6),
    attenuationDistance: 2.5,
    specularIntensity: 1,
    envMapIntensity: 1.4,
  })
}

// Letreiro em textura (gravações e etiquetas): texto claro em fundo transparente
export function letreiro(texto: string, opcoes: { largura?: number; altura?: number; fonte?: string; espaco?: number; cor?: string } = {}) {
  const { largura = 1024, altura = 128, fonte = '600 76px "Instrument Serif", Georgia, serif', espaco = 18, cor = '#ffffff' } = opcoes
  const c = document.createElement('canvas')
  c.width = largura
  c.height = altura
  const ctx = c.getContext('2d')!
  ctx.fillStyle = cor
  ctx.font = fonte
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${espaco}px`
  ctx.fillText(texto, largura / 2, altura / 2)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}
