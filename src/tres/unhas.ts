// Cena das unhas: frascos de esmalte de vidro grosso e um leque de unhas postiças no pedestal.
// O pincel sai do frasco aberto, pinta as unhas uma por uma e volta a fechar o frasco.
// Tocar ou arrastar em cima de uma unha pinta; trocar a cor limpa e pinta de novo.
import * as THREE from 'three'
import { letreiro, liberar, malha, ouro, torno, tornoQuadrado, vidro } from './formas'
import type { Peca } from './palco'
import { ESMALTES } from './dados'

export { ESMALTES }

// Unha postiça amendoada: casca fina curvada de lado a lado, com a ponta caindo de leve.
// A camada de cima carrega "pinta" (0 na cutícula, 1 na ponta) para o esmalte avançar.
const COMP = 0.46
const LARG = 0.095
const CURVA = 0.11
function unhaGeo(folga: number, espessura: number) {
  const nu = 40
  const nv = 24
  const pos: number[] = []
  const pinta: number[] = []
  const idx: number[] = []
  const meia = (u: number) =>
    u < 0.12 ? LARG * (0.82 + 0.18 * Math.sqrt(u / 0.12)) : u > 0.55 ? LARG * Math.sqrt(Math.max(1 - ((u - 0.55) / 0.45) ** 2, 0)) : LARG
  // Uma superfície da casca a uma distância r do eixo da curva
  const camada = (r: number) => {
    const ini = pos.length / 3
    for (let i = 0; i <= nu; i++) {
      const u = i / nu
      const m = Math.max(meia(u), 0.0015)
      const queda = -Math.pow(Math.max(0, u - 0.35) / 0.65, 2) * 0.035
      for (let j = 0; j <= nv; j++) {
        const v = (j / nv) * 2 - 1
        const a = (v * m) / CURVA
        pos.push(Math.sin(a) * r, u * COMP, Math.cos(a) * r - CURVA + queda)
        pinta.push(u)
      }
    }
    return ini
  }
  const cima = camada(CURVA + folga)
  const linha = nv + 1
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      const a = cima + i * linha + j
      idx.push(a, a + 1, a + linha, a + linha, a + 1, a + linha + 1)
    }
  if (espessura > 0) {
    const baixo = camada(CURVA + folga - espessura)
    for (let i = 0; i < nu; i++)
      for (let j = 0; j < nv; j++) {
        const a = baixo + i * linha + j
        idx.push(a, a + linha, a + 1, a + linha, a + linha + 1, a + 1)
      }
    // Bordas: as duas laterais e a base da cutícula
    for (let i = 0; i < nu; i++) {
      ;[0, nv].forEach((j, k) => {
        const a = cima + i * linha + j
        const b = baixo + i * linha + j
        if (k === 0) idx.push(a, a + linha, b, b, a + linha, b + linha)
        else idx.push(a, b, a + linha, b, b + linha, a + linha)
      })
    }
    for (let j = 0; j < nv; j++) {
      const a = cima + j
      const b = baixo + j
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
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
  const m = new THREE.MeshPhysicalMaterial({
    color: cor,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
  })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uProgresso = progresso
    sh.vertexShader =
      'attribute float pinta;\nvarying float vPinta;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPinta = pinta;')
    sh.fragmentShader =
      'uniform float uProgresso;\nvarying float vPinta;\n' +
      sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vPinta > uProgresso) discard;')
  }
  return { m, progresso }
}

// Frasco de vidro grosso de cantos arredondados, com o fundo pesado e o esmalte dentro
function criarFrasco(cor: number, escala: number) {
  const g = new THREE.Group()
  g.name = 'frasco'
  const casco = malha(
    'vidro',
    tornoQuadrado(
      [
        [0.001, 0],
        [0.29, 0.0],
        [0.325, 0.015],
        [0.34, 0.055],
        [0.342, 0.4],
        [0.338, 0.6],
        [0.322, 0.665],
        [0.27, 0.71],
        [0.15, 0.735],
        [0.001, 0.74],
      ],
      4.2,
      96,
    ),
    vidro(0.6),
  )
  g.add(casco)
  const liquidoMat = new THREE.MeshPhysicalMaterial({
    color: cor,
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  })
  const liquido = malha(
    'liquido',
    tornoQuadrado(
      [
        [0.001, 0.13],
        [0.27, 0.13],
        [0.292, 0.15],
        [0.298, 0.2],
        [0.298, 0.5],
        [0.29, 0.52],
        [0.001, 0.525],
      ],
      4.2,
      96,
      false,
    ),
    liquidoMat,
  )
  liquido.userData.explodeWithParent = true
  g.add(liquido)
  // Gargalo redondo com a rosca de vidro
  const gargalo = malha(
    'gargalo',
    torno(
      [
        [0.112, 0.73],
        [0.112, 0.85],
        [0.098, 0.862],
        [0.001, 0.862],
      ],
      48,
      false,
    ),
    vidro(0.2),
  )
  gargalo.userData.explodeWithParent = true
  g.add(gargalo)
  ;[0.77, 0.8, 0.83].forEach((y) => {
    const r = malha('rosca', new THREE.TorusGeometry(0.113, 0.006, 8, 48), vidro(0.1))
    r.rotation.x = Math.PI / 2
    r.position.y = y
    r.userData.explodeWithParent = true
    g.add(r)
  })
  // Nome em dourado na frente do vidro (hot stamping: brilha mesmo longe da luz)
  const rotuloTex = letreiro('LEIDE', {
    largura: 512,
    altura: 128,
    fonte: '400 92px "Instrument Serif", Georgia, serif',
    espaco: 20,
    cor: '#e8c27a',
  })
  const rotulo = malha(
    'rotulo',
    new THREE.PlaneGeometry(0.5, 0.125),
    new THREE.MeshPhysicalMaterial({
      map: rotuloTex,
      emissiveMap: rotuloTex,
      emissive: new THREE.Color(0x8a6428),
      transparent: true,
      metalness: 0.9,
      roughness: 0.38,
      depthWrite: false,
    }),
  )
  rotulo.position.set(0, 0.36, 0.3435)
  rotulo.userData.explodeWithParent = true
  g.add(rotulo)
  g.scale.setScalar(escala)
  return { grupo: g, liquidoMat }
}

// Tampa alta de metal dourado escovado, com o topo polido; o pincel sai preso nela
function criarTampa() {
  const g = new THREE.Group()
  g.add(
    malha(
      'tampa',
      torno(
        [
          [0.001, 0],
          [0.128, 0],
          [0.132, 0.01],
          [0.132, 0.6],
          [0.126, 0.625],
          [0.1, 0.632],
          [0.001, 0.634],
        ],
        64,
        false,
      ),
      ouro(0.3),
    ),
  )
  const anel = malha('tampa-friso', new THREE.TorusGeometry(0.133, 0.006, 8, 64), ouro(0.12))
  anel.rotation.x = Math.PI / 2
  anel.position.y = 0.06
  anel.userData.explodeWithParent = true
  g.add(anel)
  return g
}

export function criarUnhas(reduzido: boolean): Peca & { mudarCor: (cor: number) => void; pintar: () => void } {
  const grupo = new THREE.Group()
  let cor = ESMALTES[0].cor

  // Frasco aberto à esquerda e dois fechados atrás, com as outras cores da paleta
  const aberto = criarFrasco(cor, 1)
  aberto.grupo.position.set(-0.55, 0, -0.1)
  aberto.grupo.rotation.y = 0.35
  grupo.add(aberto.grupo)
  const outros = [criarFrasco(ESMALTES[3].cor, 0.86), criarFrasco(ESMALTES[2].cor, 0.86)]
  outros[0].grupo.position.set(0.12, 0, -0.78)
  outros[0].grupo.rotation.y = -0.25
  outros[1].grupo.position.set(0.72, 0, -0.42)
  outros[1].grupo.rotation.y = -0.6
  outros.forEach((o) => {
    const t = criarTampa()
    t.position.y = 0.862
    o.grupo.add(t)
    grupo.add(o.grupo)
  })

  // Pincel: a origem fica na ponta das cerdas, para a posição ser o ponto que toca a unha
  const pincel = new THREE.Group()
  pincel.name = 'pincel'
  const cerdasMat = new THREE.MeshPhysicalMaterial({
    color: cor,
    roughness: 0.15,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  })
  const cerdas = malha('cerdas', new THREE.SphereGeometry(1, 24, 16), cerdasMat)
  cerdas.scale.set(0.048, 0.085, 0.016)
  cerdas.position.y = 0.075
  pincel.add(cerdas)
  const haste = malha(
    'haste',
    new THREE.CylinderGeometry(0.014, 0.016, 0.56, 16),
    new THREE.MeshPhysicalMaterial({
      color: 0x1a1412,
      roughness: 0.3,
      clearcoat: 0.6,
    }),
  )
  haste.position.y = 0.14 + 0.28
  pincel.add(haste)
  const tampa = criarTampa()
  tampa.position.y = 0.69
  pincel.add(tampa)
  grupo.add(pincel)
  // Com o frasco fechado, as cerdas ficam mergulhadas no esmalte e a tampa assenta no gargalo
  aberto.grupo.updateMatrix()
  const repouso = new THREE.Vector3(0, 0.862 - 0.69, 0).applyMatrix4(aberto.grupo.matrix)
  pincel.position.copy(repouso)

  // Leque de unhas postiças deitadas na frente, com a curva para cima
  type Dedo = {
    grupo: THREE.Group
    progresso: { value: number }
    material: THREE.MeshPhysicalMaterial
  }
  const todos: Dedo[] = []
  const baseMat = new THREE.MeshPhysicalMaterial({
    color: 0xf0dccf,
    roughness: 0.32,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    sheen: 0.3,
    sheenColor: new THREE.Color(0xffe8dc),
    side: THREE.DoubleSide,
  })
  const casca = unhaGeo(0, 0.012)
  for (let i = 0; i < 5; i++) {
    const u = new THREE.Group()
    u.name = `unha-${i}`
    const base = malha(`unha-${i}-base`, casca, baseMat)
    base.userData.explodeWithParent = true
    u.add(base)
    const { m, progresso } = esmalteMaterial(cor)
    const camada = malha(`unha-${i}-esmalte`, unhaGeo(0.0035, 0), m)
    camada.userData.explodeWithParent = true
    u.add(camada)
    // Deitada: o comprimento vai para longe do centro do leque e a curva fica para cima
    u.rotation.x = -Math.PI / 2
    const deitada = new THREE.Group()
    deitada.add(u)
    const a = -0.62 + i * 0.31
    deitada.rotation.y = a + Math.PI
    deitada.position.set(0.25 + Math.sin(a) * 0.3, 0.05, 0.3 + Math.cos(a) * 0.3)
    grupo.add(deitada)
    todos.push({ grupo: u, progresso, material: m })
  }
  // As duas da ponta já chegam pintadas, para a cena mostrar o esmalte logo de cara
  todos[0].progresso.value = 1
  todos[4].progresso.value = 1

  // Controle da pintura: unha atual e quanto já foi pintado
  let atual = 1
  let auto = !reduzido
  let alvo = 0
  let espera = reduzido ? 0 : 1.2
  const tmp = new THREE.Vector3()
  const tmp2 = new THREE.Vector3()

  // As unhas não se mexem dentro do grupo: a posição de cada uma no grupo é calculada uma vez só,
  // em vez de recalcular a cena inteira a cada ponto pedido (eram dezenas de vezes por quadro)
  grupo.updateMatrixWorld(true)
  const noGrupo = todos.map((d) => d.grupo.matrixWorld.clone())
  function pontoNaUnha(i: number, u: number, alvoVetor = new THREE.Vector3()) {
    return alvoVetor.set(0, u * COMP, 0.006).applyMatrix4(noGrupo[i])
  }
  // O toque chega em coordenadas do mundo (o grupo gira com o palco)
  function pontoNoMundo(i: number, u: number, alvoVetor = new THREE.Vector3()) {
    return grupo.localToWorld(pontoNaUnha(i, u, alvoVetor))
  }

  function mudarCor(nova: number) {
    cor = nova
    todos.forEach((d) => {
      d.material.color.setHex(nova)
      d.progresso.value = 0
    })
    aberto.liquidoMat.color.setHex(nova)
    cerdasMat.color.setHex(nova)
    // Os frascos fechados mostram outras duas cores da paleta
    const resto = ESMALTES.filter((e) => e.cor !== nova)
    outros[0].liquidoMat.color.setHex(resto[resto.length - 1].cor)
    outros[1].liquidoMat.color.setHex(resto[1].cor)
    atual = 0
    alvo = 0
    espera = 0.3
    auto = true
  }
  function pintar() {
    if (todos.every((d) => d.progresso.value >= 1)) todos.forEach((d) => (d.progresso.value = 0))
    atual = todos.findIndex((d) => d.progresso.value < 1)
    auto = true
  }

  const destino = new THREE.Vector3()
  const cimaPincel = new THREE.Vector3(0, 1, 0)
  const inclinacao = new THREE.Quaternion()
  const direcao = new THREE.Vector3()
  const voo = new THREE.Vector3()
  function reiniciar() {
    mudarCor(ESMALTES[0].cor)
    todos.forEach((d, i) => (d.progresso.value = i === 0 || i === 4 ? 1 : 0))
    atual = 1
    auto = !reduzido
    espera = reduzido ? 0 : 1.2
    pincel.position.copy(repouso)
    pincel.quaternion.identity()
  }
  return {
    grupo,
    enquadramento: { distancia: 6.6, alvoY: 0.55, elevacao: 0.2 },
    mudarCor,
    pintar,
    reiniciar,
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
      let dist = 0.25
      grupo.updateWorldMatrix(true, false)
      todos.forEach((_, i) => {
        const dd = pontoNoMundo(i, 0.5, tmp).distanceTo(ponto)
        if (dd < dist) {
          dist = dd
          melhor = i
        }
      })
      if (melhor < 0) return false
      atual = melhor
      auto = false
      const ini = pontoNoMundo(melhor, 0, tmp).clone()
      const eixo = pontoNoMundo(melhor, 1, tmp2).sub(ini)
      const u = THREE.MathUtils.clamp(ponto.clone().sub(ini).dot(eixo) / eixo.lengthSq(), 0, 1)
      alvo = Math.max(todos[melhor].progresso.value, u + 0.15)
      return true
    },
    atualizar(dt) {
      const d = atual >= 0 ? todos[atual] : undefined
      if (auto && d) {
        if (espera > 0) espera -= dt
        else if (pincel.position.distanceTo(pontoNaUnha(atual, d.progresso.value, tmp)) < 0.1) {
          // Só pinta quando o pincel já chegou na unha
          d.progresso.value = Math.min(1, d.progresso.value + dt * 0.9)
          if (d.progresso.value >= 1) {
            espera = 0.25
            atual = todos.findIndex((x) => x.progresso.value < 1)
            if (atual < 0) auto = false
          }
        }
      } else if (d) {
        d.progresso.value += (Math.min(alvo, 1) - d.progresso.value) * Math.min(1, dt * 8)
      }
      const pintando = !!d && ((auto && d.progresso.value < 1) || (!auto && d.progresso.value < alvo - 0.02))
      // O pincel e as unhas vivem no mesmo grupo, que gira junto com o palco
      if (pintando && d) {
        pontoNaUnha(atual, Math.min(d.progresso.value + 0.04, 1), destino)
        // Cabo inclinado para trás, para o lado da cutícula, como quem pinta de verdade
        const ini = pontoNaUnha(atual, 0, tmp)
        const fim = pontoNaUnha(atual, 1, tmp2)
        direcao.subVectors(ini, fim).setY(0).normalize().multiplyScalar(0.75).add(cimaPincel).normalize()
      } else {
        destino.copy(repouso)
        direcao.copy(cimaPincel)
      }
      // Longe do destino, o pincel sobe antes de atravessar a cena (não passa por dentro dos frascos)
      const longe = Math.hypot(destino.x - pincel.position.x, destino.z - pincel.position.z)
      const alvoVoo = voo.copy(destino)
      if (longe > 0.12) alvoVoo.y = Math.max(destino.y, 1.05)
      const k = 1 - Math.exp(-dt * (pintando && longe < 0.12 ? 14 : 4.5))
      pincel.position.lerp(alvoVoo, k)
      // Em voo o pincel fica em pé; só inclina quando chega na unha
      inclinacao.setFromUnitVectors(cimaPincel, longe > 0.15 ? cimaPincel : direcao)
      pincel.quaternion.slerp(inclinacao, 1 - Math.exp(-dt * 6))
    },
    descartar: () => liberar(grupo),
  }
}
