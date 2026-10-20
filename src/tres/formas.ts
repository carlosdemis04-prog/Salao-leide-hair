// Ferramentas de modelagem usadas pelas peças: varredura afinada (mechas de cabelo, cerdas, cabos),
// torno (corpos redondos) e os materiais da paleta.
import * as THREE from 'three'

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

export function ouro(rugosidade = 0.24) {
  return new THREE.MeshPhysicalMaterial({
    color: CORES.ouro,
    metalness: 1,
    roughness: rugosidade,
    clearcoat: 0.4,
    clearcoatRoughness: 0.2,
  })
}

export function plastico(cor: number, rugosidade = 0.32) {
  return new THREE.MeshPhysicalMaterial({ color: cor, roughness: rugosidade, clearcoat: 0.6, clearcoatRoughness: 0.18 })
}

export function metal(cor = CORES.aco, rugosidade = 0.22) {
  return new THREE.MeshPhysicalMaterial({ color: cor, metalness: 1, roughness: rugosidade })
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
    mats.forEach((x) => x.dispose())
  })
}
