// Cena do cabelo: secador profissional e tesoura.
// Tocar no secador liga e desliga (a hélice gira e sai vento); tocar na tesoura dá um corte.
import * as THREE from 'three'
import { CORES, liberar, malha, ouro, plastico, torno, varredura } from './formas'
import type { Peca } from './palco'

function criarSecador() {
  const g = new THREE.Group()
  g.name = 'secador'
  const corpoMat = plastico(0xd9c8b0, 0.32)
  const escuro = plastico(CORES.cafe, 0.45)
  const dourado = ouro(0.2)

  // Corpo: torno ao longo de Y, depois deitado no eixo X (bico para +X)
  const corpo = new THREE.Group()
  corpo.name = 'corpo'
  corpo.rotation.z = -Math.PI / 2
  g.add(corpo)
  corpo.add(
    malha(
      'carcaca',
      torno([
        [0.4, -0.98],
        [0.465, -0.9],
        [0.475, -0.6],
        [0.46, 0.0],
        [0.43, 0.45],
        [0.37, 0.75],
        [0.33, 0.86],
      ]),
      corpoMat,
    ),
  )
  // Grade traseira: fundo escuro, anéis dourados e a hélice atrás deles
  const fundo = malha('grade', new THREE.CircleGeometry(0.4, 48), escuro)
  fundo.rotation.x = Math.PI / 2
  fundo.position.y = -0.8
  corpo.add(fundo)
  ;[0.36, 0.26, 0.16].forEach((r, i) => {
    const anel = malha(`anel-grade-${i}`, new THREE.TorusGeometry(r, 0.014, 10, 64), dourado)
    anel.rotation.x = Math.PI / 2
    anel.position.y = -0.97
    anel.userData.explodeWithParent = true
    corpo.add(anel)
  })
  const raio = malha('raio-grade', new THREE.BoxGeometry(0.8, 0.02, 0.024), dourado)
  raio.position.y = -0.97
  raio.userData.explodeWithParent = true
  corpo.add(raio)
  const raio2 = raio.clone()
  raio2.rotation.y = Math.PI / 2
  corpo.add(raio2)
  const helice = new THREE.Group()
  helice.name = 'helice'
  helice.position.y = -0.86
  for (let i = 0; i < 7; i++) {
    const pa = malha('pa', new THREE.SphereGeometry(1, 16, 8), plastico(CORES.rosa, 0.4))
    pa.scale.set(0.15, 0.012, 0.06)
    pa.position.set(Math.cos((i / 7) * Math.PI * 2) * 0.17, 0, Math.sin((i / 7) * Math.PI * 2) * 0.17)
    pa.rotation.y = -(i / 7) * Math.PI * 2
    pa.rotation.x = 0.5
    pa.userData.explodeWithParent = true
    helice.add(pa)
  }
  const cubo = malha('cubo', new THREE.SphereGeometry(0.07, 20, 12), dourado)
  cubo.scale.y = 0.6
  helice.add(cubo)
  corpo.add(helice)
  // Friso dourado entre o corpo e o bico
  const friso = malha('friso', new THREE.TorusGeometry(0.335, 0.025, 12, 64), dourado)
  friso.rotation.x = Math.PI / 2
  friso.position.y = 0.86
  corpo.add(friso)
  const frisoTras = malha('friso-traseiro', new THREE.TorusGeometry(0.43, 0.03, 12, 64), dourado)
  frisoTras.rotation.x = Math.PI / 2
  frisoTras.position.y = -0.97
  corpo.add(frisoTras)

  // Bico concentrador: começa redondo e termina achatado numa fenda
  const bicoG = new THREE.CylinderGeometry(0.3, 0.33, 0.55, 48, 8, true)
  const p = bicoG.attributes.position
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + 0.275) / 0.55 // 0 junto ao corpo, 1 na ponta
    p.setX(i, p.getX(i) * (1 + 0.22 * t))
    p.setZ(i, p.getZ(i) * (1 - 0.62 * t))
  }
  bicoG.computeVertexNormals()
  const bico = malha('bico', bicoG, escuro)
  bico.material.side = THREE.DoubleSide
  bico.position.y = 0.86 + 0.275
  corpo.add(bico)

  // Cabo levemente inclinado, com dois botões e o fio
  const caboCurva = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.22, -0.1, 0),
    new THREE.Vector3(-0.3, -0.7, 0),
    new THREE.Vector3(-0.42, -1.45, 0),
  ])
  const cabo = malha(
    'cabo',
    varredura(caboCurva, (t) => (t > 0.93 ? 0.16 * Math.sqrt(Math.max(1 - t, 0) / 0.07) : 0.19 - 0.03 * t), {
      lados: 28,
      achatar: 0.78,
      passos: 40,
    }),
    corpoMat,
  )
  g.add(cabo)
  ;[
    [-0.27, -0.55, 0xc7536a],
    [-0.31, -0.78, CORES.ouro],
  ].forEach(([x, y, cor], i) => {
    const b = malha(`botao-${i}`, new THREE.CapsuleGeometry(0.035, 0.08, 6, 12), cor === CORES.ouro ? dourado : plastico(cor, 0.3))
    b.position.set(x + 0.17, y, 0)
    b.rotation.z = 0.15
    g.add(b)
  })
  const fio = malha(
    'fio',
    varredura(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.42, -1.45, 0),
        new THREE.Vector3(-0.5, -1.7, 0.05),
        new THREE.Vector3(-0.8, -1.82, 0.25),
        new THREE.Vector3(-1.25, -1.8, 0.3),
      ]),
      (t) => (t < 0.15 ? 0.06 - t * 0.15 : 0.035),
      { lados: 10, pontaFechada: false },
    ),
    escuro,
  )
  g.add(fio)

  // Vento: fios de luz quente saindo do bico quando ligado (somam luz, como poeira num facho)
  const vento = new THREE.InstancedMesh(
    new THREE.CapsuleGeometry(0.007, 0.42, 4, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    36,
  )
  const corVento = new THREE.Color()
  const brilhoVento = new THREE.Color(0xffd29a)
  vento.name = 'vento'
  vento.castShadow = false
  const sementes = Array.from({ length: 36 }, (_, i) => ({ fase: i / 36, y: (Math.random() - 0.5) * 0.4, z: (Math.random() - 0.5) * 0.16 }))
  g.add(vento)

  let ligado = false
  let giro = 0
  let forca = 0
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
  return {
    grupo: g,
    alternar() {
      ligado = !ligado
      return ligado
    },
    get ligado() {
      return ligado
    },
    atualizar(dt: number, t: number) {
      forca += ((ligado ? 1 : 0) - forca) * Math.min(1, dt * 3)
      giro += dt * forca * 40
      helice.rotation.y = giro
      // Treme de leve quando ligado
      corpo.position.y = Math.sin(t * 90) * 0.004 * forca
      for (let i = 0; i < sementes.length; i++) {
        const s = sementes[i]
        const f = (s.fase + t * 1.6) % 1
        const x = 1.45 + f * 1.4
        const esc = forca > 0.01 ? 1 : 0
        m.compose(new THREE.Vector3(x, s.y * (1 + f * 1.4), s.z * (1 + f * 2)), q, new THREE.Vector3(esc, 1 + f, esc))
        vento.setMatrixAt(i, m)
        // Acende ao sair do bico e apaga longe dele
        vento.setColorAt(i, corVento.copy(brilhoVento).multiplyScalar(forca * Math.sin(f * Math.PI) * 0.9))
      }
      vento.instanceMatrix.needsUpdate = true
      if (vento.instanceColor) vento.instanceColor.needsUpdate = true
    },
  }
}

function criarTesoura() {
  const g = new THREE.Group()
  g.name = 'tesoura'
  // Lâminas douradas, como a tesoura da logo
  const aco = ouro(0.26)
  const dourado = ouro(0.22)

  // Lâmina: perfil com fio reto em x=0 e dorso curvo; o fio afina até quase zero (amolado de verdade)
  const forma = new THREE.Shape()
  forma.moveTo(0, -0.12)
  forma.lineTo(0, 1.1)
  forma.bezierCurveTo(0.07, 0.95, 0.14, 0.6, 0.155, 0.22)
  forma.bezierCurveTo(0.16, 0.02, 0.13, -0.12, 0.07, -0.16)
  forma.lineTo(0, -0.12)
  const espessura = 0.026
  const laminaG = new THREE.ExtrudeGeometry(forma, {
    depth: espessura,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 2,
    curveSegments: 24,
  })
  laminaG.translate(0, 0, -espessura / 2)
  const pl = laminaG.attributes.position
  for (let i = 0; i < pl.count; i++) {
    const x = pl.getX(i)
    const desbaste = THREE.MathUtils.smoothstep(x, -0.004, 0.09)
    pl.setZ(i, pl.getZ(i) * (0.12 + 0.88 * desbaste))
  }
  laminaG.computeVertexNormals()

  function metade(lado: 1 | -1) {
    const h = new THREE.Group()
    h.name = lado === 1 ? 'lamina-direita' : 'lamina-esquerda'
    const lam = malha(lado === 1 ? 'lamina-a' : 'lamina-b', laminaG, aco)
    // A lâmina fica do lado oposto à argola da mesma peça: é assim que as duas se cruzam no parafuso
    lam.scale.x = -lado
    h.add(lam)
    // Haste até a argola
    const haste = malha(
      'haste',
      varredura(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.02 * lado, -0.1, 0),
          new THREE.Vector3(0.09 * lado, -0.42, 0),
          new THREE.Vector3(0.27 * lado, -0.72, 0),
        ]),
        (t) => 0.034 - t * 0.008,
        { lados: 12, achatar: 0.55, pontaFechada: false },
      ),
      aco,
    )
    h.add(haste)
    const argola = malha('argola', new THREE.TorusGeometry(0.16, 0.036, 14, 48), dourado)
    argola.scale.set(1, 0.8, 1)
    argola.position.set(0.3 * lado, -0.86, 0)
    argola.rotation.z = 0.45 * lado
    h.add(argola)
    if (lado === 1) {
      // Apoio do dedo mínimo
      const apoio = malha(
        'apoio-dedo',
        varredura(
          new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.43, -0.97, 0),
            new THREE.Vector3(0.55, -1.06, 0),
            new THREE.Vector3(0.53, -1.2, 0),
          ]),
          (t) => 0.028 * (1 - t * 0.6),
          { lados: 10 },
        ),
        dourado,
      )
      h.add(apoio)
    }
    h.position.z = lado * 0.016
    return h
  }
  const a = metade(1)
  const b = metade(-1)
  g.add(a, b)
  const parafuso = malha('parafuso', new THREE.CylinderGeometry(0.05, 0.05, 0.08, 24), dourado)
  parafuso.rotation.x = Math.PI / 2
  g.add(parafuso)

  let corte = 0 // 0 parado, sobe até 1 durante um corte
  let cortando = false
  return {
    grupo: g,
    cortar() {
      cortando = true
      corte = 0
    },
    atualizar(dt: number, t: number) {
      let abertura = 0.32 + Math.sin(t * 1.3) * 0.04
      if (cortando) {
        corte += dt * 2.4
        // Fecha rápido e abre de novo
        const k = corte < 0.35 ? corte / 0.35 : 1 - (corte - 0.35) / 0.65
        abertura *= 1 - Math.max(0, k)
        if (corte >= 1) cortando = false
      }
      a.rotation.z = abertura / 2
      b.rotation.z = -abertura / 2
    },
  }
}

export function criarCabelo(reduzido: boolean, aoMudar: (ligado: boolean) => void = () => {}): Peca & { ligarSecador: () => boolean; cortar: () => void } {
  const grupo = new THREE.Group()
  const secador = criarSecador()
  secador.grupo.position.set(-0.35, 1.85, -0.2)
  secador.grupo.rotation.set(0.1, 0.35, 0.12)
  secador.grupo.scale.setScalar(0.82)
  const tesoura = criarTesoura()
  tesoura.grupo.position.set(0.7, 0.95, 0.45)
  tesoura.grupo.rotation.set(0.15, -0.5, -0.55)
  tesoura.grupo.scale.setScalar(0.78)
  grupo.add(secador.grupo, tesoura.grupo)

  return {
    grupo,
    enquadramento: { distancia: 7.9, alvoY: 1.2 },
    ligarSecador: () => {
      const ligado = secador.alternar()
      aoMudar(ligado)
      return ligado
    },
    cortar: () => tesoura.cortar(),
    tocar(nome) {
      const tesouraPartes = ['lamina-direita', 'lamina-esquerda', 'parafuso', 'tesoura']
      let o = grupo.getObjectByName(nome)
      while (o && o !== grupo) {
        if (tesouraPartes.includes(o.name)) return tesoura.cortar()
        if (o.name === 'secador') return void aoMudar(secador.alternar())
        o = o.parent ?? undefined
      }
    },
    atualizar(dt, t) {
      const flutua = reduzido ? 0 : 1
      secador.grupo.position.y = 1.85 + Math.sin(t * 0.9) * 0.05 * flutua
      tesoura.grupo.position.y = 0.95 + Math.sin(t * 0.9 + 1.4) * 0.06 * flutua
      secador.atualizar(dt, t)
      tesoura.atualizar(dt, t)
    },
    descartar: () => liberar(grupo),
  }
}
