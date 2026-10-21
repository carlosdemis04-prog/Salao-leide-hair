// Cena do cabelo: um secador profissional deitado no pedestal e uma tesoura de corte ao lado,
// como numa foto de produto. Tocar no secador liga e desliga (sai vento e a resistência acende);
// tocar na tesoura dá um corte.
import * as THREE from 'three'
import { CORES, emborrachado, letreiro, liberar, malha, ouro, perfilado, pinturaMetalica, torno, varredura } from './formas'
import { chapaPerfurada } from './texturas'
import type { Peca } from './palco'

// Torno deitado: o perfil é dado ao longo de Y e a peça fica no eixo X (bico para +X)
function deitado(g: THREE.BufferGeometry) {
  g.rotateZ(-Math.PI / 2)
  return g
}

function criarSecador() {
  const g = new THREE.Group()
  g.name = 'secador'
  const corpoMat = pinturaMetalica(0xd6bb8c, 0.3)
  const preto = emborrachado()
  const dourado = ouro(0.16)

  // Carcaça em pintura champanhe, mais larga atrás e afinando até o bico
  g.add(
    malha(
      'carcaca',
      deitado(
        torno(
          [
            [0.446, -0.84],
            [0.452, -0.62],
            [0.447, -0.3],
            [0.432, 0.05],
            [0.408, 0.38],
            [0.381, 0.6],
            [0.364, 0.7],
          ],
          96,
        ),
      ),
      corpoMat,
    ),
  )
  // Nome gravado em dourado na lateral, acompanhando a curva da carcaça (o texto corre ao longo do corpo)
  const gravacao = letreiro('LEIDE HAIR', { largura: 1024, altura: 700, fonte: '400 104px "Instrument Serif", Georgia, serif', espaco: 22, cor: '#e8c27a' })
  gravacao.center.set(0.5, 0.5)
  gravacao.rotation = Math.PI / 2
  const nome = malha(
    'gravacao',
    deitado(new THREE.CylinderGeometry(0.4515, 0.4515, 0.62, 64, 1, true, Math.PI * 0.35, Math.PI * 0.3)),
    new THREE.MeshPhysicalMaterial({
      map: gravacao,
      transparent: true,
      metalness: 1,
      roughness: 0.25,
      depthWrite: false,
    }),
  )
  nome.position.x = -0.38
  nome.rotation.x = -Math.PI / 2
  nome.userData.explodeWithParent = true
  g.add(nome)

  // Tampa traseira emborrachada com o filtro de chapa perfurada
  g.add(
    malha(
      'tampa-traseira',
      deitado(
        torno(
          [
            [0.36, -0.99],
            [0.385, -0.996],
            [0.415, -0.982],
            [0.436, -0.95],
            [0.444, -0.9],
            [0.438, -0.845],
          ],
          96,
        ),
      ),
      preto,
    ),
  )
  const furos = chapaPerfurada()
  const filtro = malha(
    'filtro',
    new THREE.CircleGeometry(0.365, 72),
    new THREE.MeshPhysicalMaterial({ color: 0xb59a74, metalness: 1, roughness: 0.32, map: furos.cor, normalMap: furos.normal, normalScale: new THREE.Vector2(0.6, 0.6) }),
  )
  filtro.rotation.y = -Math.PI / 2
  filtro.position.x = -0.978
  filtro.userData.explodeWithParent = true
  g.add(filtro)
  // Frisos dourados polidos nas duas emendas
  ;[
    [-0.843, 0.447, 0.011],
    [0.7, 0.364, 0.012],
  ].forEach(([x, r, e], i) => {
    const f = malha(`friso-${i}`, new THREE.TorusGeometry(r, e, 16, 128), dourado)
    f.rotation.y = Math.PI / 2
    f.position.x = x
    f.userData.explodeWithParent = true
    g.add(f)
  })

  // Colar e bico concentrador: sai redondo do corpo e termina numa fenda achatada
  g.add(
    malha(
      'colar',
      deitado(
        torno(
          [
            [0.358, 0.7],
            [0.356, 0.76],
            [0.345, 0.8],
          ],
          96,
          false,
        ),
      ),
      preto,
    ),
  )
  const bicoCurva = new THREE.LineCurve3(new THREE.Vector3(0.79, 0, 0), new THREE.Vector3(1.36, 0, 0))
  const bico = malha(
    'bico',
    perfilado(
      bicoCurva,
      (t) => {
        const k = THREE.MathUtils.smoothstep(t, 0, 0.85)
        return { largura: THREE.MathUtils.lerp(0.34, 0.092, k), altura: THREE.MathUtils.lerp(0.34, 0.4, k), n: THREE.MathUtils.lerp(2, 5, k) }
      },
      { passos: 40, lados: 96, cima: new THREE.Vector3(0, 1, 0) },
    ),
    preto,
  )
  g.add(bico)
  // A fenda: escura por dentro, e a resistência acende em laranja quando liga
  const fendaMat = new THREE.MeshStandardMaterial({ color: 0x030202, roughness: 0.9, emissive: new THREE.Color(0xff6a1e), emissiveIntensity: 0 })
  const fenda = malha(
    'fenda',
    perfilado(new THREE.LineCurve3(new THREE.Vector3(1.355, 0, 0), new THREE.Vector3(1.364, 0, 0)), () => ({ largura: 0.058, altura: 0.36, n: 5 }), {
      passos: 1,
      lados: 64,
      cima: new THREE.Vector3(0, 1, 0),
    }),
    fendaMat,
  )
  fenda.userData.explodeWithParent = true
  g.add(fenda)

  // Cabo emborrachado de seção quase retangular, com a ponta arredondada
  const caboCurva = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.2, -0.05, 0),
    new THREE.Vector3(-0.25, -0.6, 0),
    new THREE.Vector3(-0.36, -1.32, 0),
  ])
  g.add(
    malha(
      'cabo',
      perfilado(
        caboCurva,
        (t) => {
          const fim = t > 0.9 ? Math.sqrt(Math.max(0, 1 - ((t - 0.9) / 0.1) ** 2)) : 1
          return { largura: (0.172 - 0.018 * t) * (0.25 + 0.75 * fim), altura: (0.148 - 0.014 * t) * (0.25 + 0.75 * fim), n: 3.2 }
        },
        { passos: 64, lados: 64 },
      ),
      preto,
    ),
  )
  // Anel champanhe perto da ponta do cabo
  const anelCabo = malha(
    'anel-cabo',
    perfilado(
      new THREE.CatmullRomCurve3([caboCurva.getPointAt(0.8), caboCurva.getPointAt(0.84)]),
      () => ({ largura: 0.158, altura: 0.136, n: 3.2 }),
      { passos: 2, lados: 64, tampas: false },
    ),
    corpoMat,
  )
  anelCabo.userData.explodeWithParent = true
  g.add(anelCabo)

  // Chaves de velocidade e temperatura na lateral do cabo, e o botão de ar frio na frente
  const trilhoMat = new THREE.MeshStandardMaterial({ color: 0x050404, roughness: 0.5 })
  ;[0.28, 0.5].forEach((t, i) => {
    const c = caboCurva.getPointAt(t)
    const trilho = malha(
      `trilho-${i}`,
      perfilado(new THREE.LineCurve3(c.clone().add(new THREE.Vector3(0.01, 0.09, 0)), c.clone().add(new THREE.Vector3(-0.01, -0.09, 0))), () => ({ largura: 0.034, altura: 0.012, n: 4 }), {
        passos: 1,
        lados: 32,
      }),
      trilhoMat,
    )
    trilho.position.z = 0.142 - 0.012 * t
    trilho.userData.explodeWithParent = true
    g.add(trilho)
    const chave = malha(
      `chave-${i}`,
      perfilado(new THREE.LineCurve3(c.clone().add(new THREE.Vector3(0.005, 0.035 - i * 0.05, 0)), c.clone().add(new THREE.Vector3(-0.002, -0.005 - i * 0.05, 0))), () => ({ largura: 0.04, altura: 0.018, n: 3 }), {
        passos: 1,
        lados: 32,
      }),
      dourado,
    )
    chave.position.z = 0.154 - 0.012 * t
    chave.userData.explodeWithParent = true
    g.add(chave)
  })
  const frio = malha('botao-frio', new THREE.CapsuleGeometry(0.03, 0.07, 8, 20), dourado)
  const pf = caboCurva.getPointAt(0.18)
  frio.position.set(pf.x + 0.168, pf.y, 0)
  frio.rotation.z = 0.06
  frio.scale.x = 0.55
  frio.userData.explodeWithParent = true
  g.add(frio)

  // Saída do fio com a capa sanfonada e o fio caindo para fora do pedestal
  const ponta = caboCurva.getPointAt(1)
  const saida = new THREE.CatmullRomCurve3([ponta.clone().add(new THREE.Vector3(0.02, 0.1, 0)), ponta.clone().add(new THREE.Vector3(-0.03, -0.12, 0))])
  const capa = malha(
    'capa-fio',
    varredura(saida, (t) => (0.062 - t * 0.022) * (1 + 0.08 * Math.sin(t * 40)), { passos: 60, lados: 20, pontaFechada: true }),
    preto,
  )
  capa.userData.explodeWithParent = true
  g.add(capa)

  // Vento: fios de luz quente saindo do bico quando ligado (somam luz, como poeira num facho)
  const vento = new THREE.InstancedMesh(
    new THREE.CapsuleGeometry(0.006, 0.4, 4, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    40,
  )
  vento.name = 'vento'
  vento.castShadow = false
  const corVento = new THREE.Color()
  const brilhoVento = new THREE.Color(0xffd29a)
  const sementes = Array.from({ length: 40 }, (_, i) => ({ fase: i / 40, y: (Math.random() - 0.5) * 0.06, z: (Math.random() - 0.5) * 0.34 }))
  g.add(vento)

  let ligado = false
  let forca = 0
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
  const v = new THREE.Vector3()
  const s = new THREE.Vector3()
  return {
    grupo: g,
    ponta,
    alternar() {
      ligado = !ligado
      return ligado
    },
    atualizar(dt: number, t: number) {
      forca += ((ligado ? 1 : 0) - forca) * Math.min(1, dt * 3)
      fendaMat.emissiveIntensity = forca * 2.2
      for (let i = 0; i < sementes.length; i++) {
        const sm = sementes[i]
        const f = (sm.fase + t * 1.6) % 1
        const esc = forca > 0.01 ? 1 : 0
        m.compose(v.set(1.5 + f * 1.5, sm.y * (1 + f * 6), sm.z * (1 + f * 1.2)), q, s.set(esc, 1 + f, esc))
        vento.setMatrixAt(i, m)
        // Acende ao sair do bico e apaga longe dele
        vento.setColorAt(i, corVento.copy(brilhoVento).multiplyScalar(forca * Math.sin(f * Math.PI) * 0.8))
      }
      vento.instanceMatrix.needsUpdate = true
      if (vento.instanceColor) vento.instanceColor.needsUpdate = true
    },
  }
}

function criarTesoura() {
  const g = new THREE.Group()
  g.name = 'tesoura'
  const espelho = new THREE.MeshPhysicalMaterial({ color: CORES.aco, metalness: 1, roughness: 0.08, envMapIntensity: 2.4, clearcoat: 0.3 })
  const dourado = ouro(0.16)
  const borracha = emborrachado(0x0b0a0a)

  // Lâmina convexa: fio quase reto em x=0, dorso curvo e a ponta fina; a base vira o "olho" do parafuso
  const forma = new THREE.Shape()
  forma.moveTo(0, -0.02)
  forma.lineTo(-0.004, 1.12)
  forma.bezierCurveTo(0.025, 1.04, 0.074, 0.72, 0.086, 0.34)
  forma.bezierCurveTo(0.092, 0.14, 0.09, 0.04, 0.08, -0.04)
  forma.absarc(0, -0.04, 0.08, 0, -Math.PI, true)
  forma.lineTo(0, -0.02)
  const esp = 0.02
  const laminaG = new THREE.ExtrudeGeometry(forma, {
    depth: esp,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 3,
    curveSegments: 48,
  })
  laminaG.translate(0, 0, -esp / 2)
  // Desbaste do fio: a lâmina afina até quase nada no lado do corte
  const pl = laminaG.attributes.position
  for (let i = 0; i < pl.count; i++) {
    const x = pl.getX(i)
    const y = pl.getY(i)
    const desbaste = y > 0.08 ? THREE.MathUtils.smoothstep(x, -0.004, 0.06) : 1
    pl.setZ(i, pl.getZ(i) * (0.15 + 0.85 * desbaste))
  }
  laminaG.computeVertexNormals()

  // Argola: oval achatada (não é um toro redondo), com o anel de silicone preto por dentro
  function argola(nome: string, rx: number, ry: number, grossura: number) {
    const a = new THREE.Group()
    a.name = nome
    const pts = Array.from({ length: 24 }, (_, i) => {
      const t = (i / 24) * Math.PI * 2
      return new THREE.Vector3(Math.cos(t) * rx, Math.sin(t) * ry * (Math.sin(t) < 0 ? 1.12 : 1), 0)
    })
    const curva = new THREE.CatmullRomCurve3(pts, true, 'centripetal')
    // O normal da varredura aponta para fora do plano: a seção fica fina em z e larga no plano
    a.add(malha(`${nome}-aro`, varredura(curva, () => grossura * 0.62, { passos: 96, lados: 16, achatar: 1.6, pontaFechada: false }), dourado))
    const pts2 = pts.map((p) => p.clone().multiplyScalar(1 - (grossura * 1.05) / Math.min(rx, ry)))
    const dentro = malha(
      `${nome}-silicone`,
      varredura(new THREE.CatmullRomCurve3(pts2, true, 'centripetal'), () => grossura * 0.4, { passos: 96, lados: 12, achatar: 1.1, pontaFechada: false }),
      borracha,
    )
    dentro.userData.explodeWithParent = true
    a.add(dentro)
    return a
  }

  function metade(lado: 1 | -1) {
    const h = new THREE.Group()
    h.name = lado === 1 ? 'lamina-direita' : 'lamina-esquerda'
    const lam = malha(lado === 1 ? 'lamina-a' : 'lamina-b', laminaG, espelho)
    // A lâmina fica do lado oposto à argola da mesma peça: é assim que as duas se cruzam no parafuso
    lam.scale.x = -lado
    h.add(lam)
    // Haste dourada do olho até a argola; a do dedão é mais curta (tesoura de cabo deslocado)
    const curto = lado === -1
    const fim = curto ? new THREE.Vector3(0.2 * lado, -0.5, 0) : new THREE.Vector3(0.24 * lado, -0.62, 0)
    const haste = malha(
      'haste',
      perfilado(
        new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0.06 * lado, -0.25, 0), fim]),
        (t) => ({ largura: 0.032 - t * 0.008, altura: 0.013, n: 3 }),
        { passos: 40, lados: 24 },
      ),
      dourado,
    )
    h.add(haste)
    const arg = curto ? argola('argola-dedao', 0.13, 0.105, 0.026) : argola('argola-dedos', 0.16, 0.125, 0.028)
    // A argola continua a direção da haste, encostando nela pela borda
    const rumo = fim.clone().sub(new THREE.Vector3(0.06 * lado, -0.25, 0)).normalize()
    arg.position.copy(fim).addScaledVector(rumo, curto ? 0.11 : 0.13)
    arg.rotation.z = (curto ? 0.6 : 0.35) * lado
    h.add(arg)
    if (!curto) {
      // Apoio do dedo mínimo, removível nas tesouras de verdade
      const apoio = malha(
        'apoio-dedo',
        varredura(
          new THREE.CatmullRomCurve3(
            [
              [0.1, -0.09],
              [0.2, -0.13],
              [0.24, -0.22],
              [0.2, -0.29],
            ].map(([x, y]) => arg.position.clone().add(new THREE.Vector3(x, y, 0))),
          ),
          (t) => 0.014 * (1 - t * 0.5),
          { lados: 12, achatar: 1.4 },
        ),
        dourado,
      )
      h.add(apoio)
    }
    h.position.z = lado * 0.012
    return h
  }
  const a = metade(1)
  const b = metade(-1)
  g.add(a, b)

  // Parafuso de tensão: arruela, disco serrilhado e a cabeça polida
  const parafuso = new THREE.Group()
  parafuso.name = 'parafuso'
  const arruela = malha('arruela', new THREE.CylinderGeometry(0.06, 0.06, 0.01, 48), espelho)
  arruela.rotation.x = Math.PI / 2
  arruela.position.z = 0.03
  parafuso.add(arruela)
  const discoG = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 96, 1)
  const pd = discoG.attributes.position
  for (let i = 0; i < pd.count; i++) {
    const x = pd.getX(i)
    const z = pd.getZ(i)
    const r = Math.hypot(x, z)
    if (r < 0.01) continue
    const nr = r * (1 + 0.04 * Math.sign(Math.sin(Math.atan2(z, x) * 24)))
    pd.setX(i, (x / r) * nr)
    pd.setZ(i, (z / r) * nr)
  }
  discoG.computeVertexNormals()
  const disco = malha('disco', discoG, dourado)
  disco.rotation.x = Math.PI / 2
  disco.position.z = 0.045
  parafuso.add(disco)
  const cabeca = malha('cabeca-parafuso', new THREE.SphereGeometry(0.034, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), dourado)
  cabeca.rotation.x = Math.PI / 2
  cabeca.position.z = 0.055
  parafuso.add(cabeca)
  parafuso.traverse((o) => (o.userData.explodeWithParent = o !== parafuso))
  g.add(parafuso)

  let corte = 0
  let cortando = false
  return {
    grupo: g,
    cortar() {
      cortando = true
      corte = 0
    },
    atualizar(dt: number) {
      let abertura = 0.3
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
  // Deitado de lado no pedestal, com o cabo virado para a câmera e a ponta do cabo encostando
  const ESC = 0.8
  secador.grupo.scale.setScalar(ESC)
  secador.grupo.rotation.set(-Math.PI / 2 + 0.24, 0, 0, 'XYZ')
  const apoio = new THREE.Group()
  apoio.add(secador.grupo)
  apoio.rotation.y = Math.PI - 0.35
  // O centro do conjunto (corpo mais cabo) fica no meio do pedestal
  apoio.position.set(-Math.sin(apoio.rotation.y) * 0.12 - 0.15, 0.452 * ESC, -Math.cos(apoio.rotation.y) * 0.12 - 0.25)
  grupo.add(apoio)

  // Fio: sai do cabo, cai no tampo e escorrega para fora pela borda de trás
  apoio.updateMatrixWorld(true)
  const saidaFio = secador.grupo.localToWorld(secador.ponta.clone().add(new THREE.Vector3(-0.03, -0.12, 0)))
  const fio = malha(
    'fio',
    varredura(
      new THREE.CatmullRomCurve3(
        (() => {
          // Segue a direção do cabo, faz uma curva no tampo e sai pela borda
          const dir = new THREE.Vector3(Math.sin(apoio.rotation.y), 0, Math.cos(apoio.rotation.y))
          const lado = new THREE.Vector3(dir.z, 0, -dir.x)
          const noTampo = (d: number, l: number) => saidaFio.clone().setY(0.026).addScaledVector(dir, d).addScaledVector(lado, l)
          const borda = (r: number, y: number) => {
            const p = noTampo(0.7, 0.55)
            return p.setY(0).normalize().multiplyScalar(r).setY(y)
          }
          return [saidaFio, noTampo(0.12, 0).setY(0.045), noTampo(0.4, 0.15), noTampo(0.7, 0.55), borda(1.3, 0.026), borda(1.4, -0.03), borda(1.45, -0.2), borda(1.5, -0.9)]
        })(),
      ),
      () => 0.026,
      { lados: 12, passos: 120, pontaFechada: false },
    ),
    emborrachado(),
  )
  grupo.add(fio)

  const tesoura = criarTesoura()
  tesoura.grupo.rotation.set(-Math.PI / 2, 0, 0)
  const tesouraBase = new THREE.Group()
  tesouraBase.add(tesoura.grupo)
  tesouraBase.rotation.y = -1.2
  tesouraBase.position.set(0.28, 0.038, 0.72)
  tesouraBase.scale.setScalar(0.9)
  grupo.add(tesouraBase)

  return {
    grupo,
    enquadramento: { distancia: 6.9, alvoY: 0.42, elevacao: 0.26 },
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
        if (o.name === 'secador' || o.name === 'fio') return void aoMudar(secador.alternar())
        o = o.parent ?? undefined
      }
    },
    atualizar(dt, t) {
      secador.atualizar(dt, reduzido ? 0 : t)
      tesoura.atualizar(dt)
    },
    descartar: () => liberar(grupo),
  }
}
