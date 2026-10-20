// Cena das unhas: uma mão com o pincel do esmalte passando unha por unha.
// Tocar ou arrastar em cima de uma unha pinta; trocar a cor limpa e pinta de novo.
import * as THREE from 'three'
import { liberar, malha, ouro, torno } from './formas'
import type { Peca } from './palco'
import { ESMALTES } from './dados'

export { ESMALTES }

const PELE = 0xd29a78

// Unha: grade (u ao longo do dedo, v de lado a lado) curvada sobre um cilindro do tamanho do dedo
function unhaGeo(largura: number, comprimento: number, curva: number, folga: number) {
  const nu = 24
  const nv = 16
  const pos: number[] = []
  const pinta: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= nu; i++) {
    const u = i / nu
    // Formato amendoado: base arredondada na cutícula, ponta oval
    const meia =
      u < 0.18 ? largura * Math.sqrt(Math.max(u / 0.18, 0.02)) * 0.92 + largura * 0.08 : u > 0.72 ? largura * Math.sqrt(Math.max(1 - ((u - 0.72) / 0.28) ** 2, 0.0004)) : largura
    for (let j = 0; j <= nv; j++) {
      const v = (j / nv) * 2 - 1
      const x = v * meia
      const a = x / curva
      const y = u * comprimento
      // A ponta livre desce um pouco, como uma unha de verdade
      const queda = u > 0.8 ? -(((u - 0.8) / 0.2) ** 2) * 0.02 : 0
      pos.push(Math.sin(a) * (curva + folga), y, Math.cos(a) * (curva + folga) - curva + queda)
      pinta.push(u)
    }
  }
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j
      const b = a + nv + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('pinta', new THREE.Float32BufferAttribute(pinta, 1))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// Esmalte: mesma unha, um fio acima, que só aparece até onde o pincel já passou
function esmalteMaterial(cor: number) {
  const progresso = { value: 0 }
  const m = new THREE.MeshPhysicalMaterial({ color: cor, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uProgresso = progresso
    sh.vertexShader = 'attribute float pinta;\nvarying float vPinta;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPinta = pinta;')
    sh.fragmentShader =
      'uniform float uProgresso;\nvarying float vPinta;\n' +
      sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vPinta > uProgresso) discard;')
  }
  return { m, progresso }
}

function criarDedo(nome: string, comprimento: number, raio: number, corEsmalte: number) {
  const g = new THREE.Group()
  g.name = nome
  const pele = new THREE.MeshPhysicalMaterial({ color: PELE, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xffc2b0) })
  const L = comprimento
  const dedo = malha(
    `${nome}-pele`,
    torno([
      [raio * 1.05, -0.1],
      [raio * 1.08, L * 0.3],
      [raio * 1.02, L * 0.55],
      [raio * 1.04, L * 0.62],
      [raio * 0.94, L * 0.85],
      [raio * 0.78, L * 0.96],
      [raio * 0.4, L * 1.01],
      [0.001, L * 1.02],
    ]),
    pele,
  )
  dedo.scale.z = 0.82
  g.add(dedo)
  // A unha cobre o último terço do dedo e passa um pouco da ponta
  const largura = raio * 0.62
  const compUnha = L * 0.34
  const base = new THREE.Mesh(unhaGeo(largura, compUnha, raio * 0.82, 0.004), new THREE.MeshPhysicalMaterial({ color: 0xd49488, roughness: 0.32, clearcoat: 0.3, side: THREE.DoubleSide }))
  base.name = `${nome}-unha`
  base.position.set(0, L * 0.71, raio * 0.82)
  g.add(base)
  const { m, progresso } = esmalteMaterial(corEsmalte)
  const camada = new THREE.Mesh(unhaGeo(largura * 1.01, compUnha, raio * 0.82, 0.012), m)
  camada.name = `${nome}-esmalte`
  camada.userData.explodeWithParent = true
  camada.position.copy(base.position)
  g.add(camada)
  return { grupo: g, progresso, material: m, unhaY: L * 0.71, compUnha, raio }
}

export function criarUnhas(reduzido: boolean): Peca & { mudarCor: (cor: number) => void; pintar: () => void } {
  const grupo = new THREE.Group()
  let cor = ESMALTES[0].cor

  // Mão deitada com o dorso para cima; dedos saem da palma no eixo +Y local
  const mao = new THREE.Group()
  mao.name = 'mao'
  const pele = new THREE.MeshPhysicalMaterial({ color: PELE, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xffc2b0) })
  const palma = malha('palma', new THREE.SphereGeometry(1, 40, 24), pele)
  palma.scale.set(0.62, 0.72, 0.2)
  mao.add(palma)
  const punho = malha('punho', torno([[0.001, -1.12], [0.3, -1.1], [0.4, -1.0], [0.44, -0.8], [0.5, -0.4], [0.55, -0.1]]), pele)
  punho.scale.z = 0.5
  mao.add(punho)
  // Pulseira dourada fina no pulso, como a joia da logo
  const pulseira = malha('pulseira', new THREE.TorusGeometry(0.445, 0.035, 16, 64), ouro(0.2))
  pulseira.rotation.x = Math.PI / 2
  pulseira.scale.y = 0.52
  pulseira.position.y = -0.78
  mao.add(pulseira)
  const dedos = [
    criarDedo('indicador', 0.92, 0.13, cor),
    criarDedo('medio', 1.02, 0.135, cor),
    criarDedo('anelar', 0.95, 0.128, cor),
    criarDedo('minimo', 0.75, 0.112, cor),
  ]
  const xs = [-0.42, -0.14, 0.14, 0.4]
  const abre = [0.1, 0.03, -0.04, -0.12]
  dedos.forEach((d, i) => {
    d.grupo.position.set(xs[i], 0.55, 0.02)
    d.grupo.rotation.z = abre[i]
    mao.add(d.grupo)
  })
  const polegar = criarDedo('polegar', 0.78, 0.15, cor)
  polegar.grupo.position.set(-0.55, -0.15, 0.04)
  polegar.grupo.rotation.z = 0.95
  polegar.grupo.rotation.y = -0.35
  mao.add(polegar.grupo)
  const todos = [...dedos, polegar]
  // O mínimo e o polegar já chegam pintados, para a cena mostrar o esmalte logo de cara
  dedos[3].progresso.value = 1
  polegar.progresso.value = 1

  mao.rotation.set(-1.0, 0, -0.55)
  mao.scale.setScalar(0.8)
  mao.position.set(-0.15, 1.15, 0)
  grupo.add(mao)

  // Vidro de esmalte com o pincel fora
  const vidro = new THREE.Group()
  vidro.name = 'vidro'
  const vidroMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, transmission: 0.9, thickness: 0.4, ior: 1.45 })
  const corpo = malha(
    'frasco',
    torno([
      [0.001, 0],
      [0.34, 0.01],
      [0.38, 0.08],
      [0.38, 0.5],
      [0.3, 0.68],
      [0.12, 0.76],
      [0.12, 0.86],
    ]),
    vidroMat,
  )
  vidro.add(corpo)
  const liquidoMat = new THREE.MeshPhysicalMaterial({ color: cor, roughness: 0.18, clearcoat: 1 })
  const liquido = malha(
    'liquido',
    torno([
      [0.001, 0.04],
      [0.32, 0.05],
      [0.34, 0.1],
      [0.34, 0.48],
      [0.001, 0.5],
    ], 48, false),
    liquidoMat,
  )
  vidro.add(liquido)
  const rosca = malha('rosca', new THREE.CylinderGeometry(0.125, 0.125, 0.08, 32), ouro(0.25))
  rosca.position.y = 0.84
  vidro.add(rosca)
  vidro.scale.setScalar(0.78)
  vidro.position.set(1.15, 0, 0.55)
  grupo.add(vidro)

  // Pincel: tampa dourada, haste e cerdas com a cor do esmalte
  const pincel = new THREE.Group()
  pincel.name = 'pincel'
  const tampa = malha('tampa', new THREE.CylinderGeometry(0.11, 0.12, 0.7, 32), ouro(0.22))
  tampa.position.y = 0.95
  pincel.add(tampa)
  const haste = malha('haste', new THREE.CylinderGeometry(0.018, 0.018, 0.55, 12), new THREE.MeshPhysicalMaterial({ color: 0x2b211c, roughness: 0.4 }))
  haste.position.y = 0.33
  pincel.add(haste)
  const cerdasMat = new THREE.MeshPhysicalMaterial({ color: cor, roughness: 0.25, clearcoat: 0.8 })
  const cerdas = malha('cerdas', torno([[0.001, -0.02], [0.03, 0.0], [0.045, 0.08], [0.03, 0.14]], 24), cerdasMat)
  cerdas.scale.z = 0.45
  pincel.add(cerdas)
  pincel.scale.setScalar(0.8)
  grupo.add(pincel)

  // Controle da pintura: dedo atual e quanto da unha já foi pintado
  let atual = 0
  let auto = !reduzido
  let alvo = 0 // progresso pedido para o dedo atual
  let espera = 0
  const pontaLocal = new THREE.Vector3()
  const pontaMundo = new THREE.Vector3()
  const repouso = new THREE.Vector3(1.15, 1.05, 0.55)

  function pontoNaUnha(d: (typeof todos)[number], u: number) {
    pontaLocal.set(0, d.unhaY + d.compUnha * u, d.raio * 0.82 + 0.03)
    return d.grupo.localToWorld(pontaMundo.copy(pontaLocal))
  }

  function mudarCor(nova: number) {
    cor = nova
    todos.forEach((d) => {
      d.material.color.setHex(nova)
      d.progresso.value = 0
    })
    liquidoMat.color.setHex(nova)
    cerdasMat.color.setHex(nova)
    atual = 0
    alvo = 0
    auto = true
  }
  function pintar() {
    // Começa (ou recomeça) a pintar a partir do primeiro dedo sem esmalte
    if (todos.every((d) => d.progresso.value >= 1)) todos.forEach((d) => (d.progresso.value = 0))
    atual = todos.findIndex((d) => d.progresso.value < 1)
    auto = true
  }

  return {
    grupo,
    enquadramento: { distancia: 7.2, alvoY: 1.05 },
    mudarCor,
    pintar,
    tocar(nome) {
      const i = todos.findIndex((d) => nome.startsWith(d.grupo.name))
      if (i >= 0) {
        atual = i
        todos[i].progresso.value = 0
        auto = true
      } else pintar()
    },
    arrastar(ponto) {
      if (!ponto) return false
      // Escolhe a unha mais perto do dedo e pinta até a altura do toque
      let melhor = -1
      let dist = 0.35
      todos.forEach((d, i) => {
        const p = pontoNaUnha(d, 0.5)
        const dd = p.distanceTo(ponto)
        if (dd < dist) {
          dist = dd
          melhor = i
        }
      })
      if (melhor < 0) return false
      atual = melhor
      auto = false
      const ini = pontoNaUnha(todos[melhor], 0)
      const fim = pontoNaUnha(todos[melhor], 1)
      const eixo = fim.clone().sub(ini)
      const u = THREE.MathUtils.clamp(ponto.clone().sub(ini).dot(eixo) / eixo.lengthSq(), 0, 1)
      alvo = Math.max(todos[melhor].progresso.value, u + 0.15)
      return true
    },
    atualizar(dt, t) {
      const d = todos[atual]
      if (auto && d) {
        if (espera > 0) espera -= dt
        else {
          d.progresso.value = Math.min(1, d.progresso.value + dt * 1.1)
          if (d.progresso.value >= 1) {
            espera = 0.35
            atual = todos.findIndex((x) => x.progresso.value < 1)
            if (atual < 0) {
              atual = 0
              auto = false
            }
          }
        }
      } else if (d) {
        d.progresso.value += (Math.min(alvo, 1) - d.progresso.value) * Math.min(1, dt * 8)
      }
      // O pincel acompanha a unha que está sendo pintada; sem nada a pintar, volta para perto do vidro
      const pintando = (auto && atual >= 0 && todos[atual].progresso.value < 1) || (!auto && d && d.progresso.value < alvo - 0.02)
      // pontoNaUnha devolve coordenadas do mundo; o pincel vive no grupo, que gira junto com o palco
      const destino = pintando && d ? grupo.worldToLocal(pontoNaUnha(d, Math.min(d.progresso.value + 0.08, 1))) : repouso
      pincel.position.lerp(destino, Math.min(1, dt * (pintando ? 10 : 3)))
      pincel.rotation.set(0.25, 0, pintando ? -0.5 : 0.15)
      mao.position.y = 1.15 + (reduzido ? 0 : Math.sin(t * 0.8) * 0.03)
    },
    descartar: () => liberar(grupo),
  }
}
