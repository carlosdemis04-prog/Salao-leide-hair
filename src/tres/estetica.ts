// Cena da estética: a figura da logo fundida em ouro, presa dentro de um bloco de cristal,
// sobre uma base de pedra preta com a placa gravada. É um troféu de verdade, girando no pedestal.
// Tocar troca o acabamento do ouro, e uma luz passa por cima a cada troca.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { texturasDaFigura } from './figura'
import { letreiro, liberar, malha, ouro } from './formas'
import { salaDoRelevo } from './relevo'
import type { Peca } from './palco'
import { ACABAMENTOS } from './dados'

const LARGURA = 1.5
const BLOCO = { l: 1.78, a: 1.12, p: 0.4 }
const BASE = { l: 1.96, a: 0.2, p: 0.6 }

// A figura vira um sólido fino: as duas faces se encontram no contorno (borda arredondada,
// como peça fundida) e cada mecha ganha volume em cima disso
async function criarFigura(material: THREE.MeshPhysicalMaterial, celular: boolean) {
  // Chanfro estreito no contorno (o contorno desfocado vem pronto do worker); por dentro a peça é
  // chapada, com as mechas em relevo por cima
  const t = await texturasDaFigura('/figura.webp', celular ? 700 : 1100, { cinza: true, borda: 0.0045 })
  const { altura, w, h } = t.campos
  const borda = t.campos.borda!
  const nx = celular ? 220 : 340
  const ny = Math.round(nx / t.aspecto)
  const geo = new THREE.PlaneGeometry(LARGURA, LARGURA / t.aspecto, nx, ny)
  const p = geo.attributes.position
  const uv = geo.attributes.uv
  for (let i = 0; i < p.count; i++) {
    const x = Math.min(w - 1, Math.round(uv.getX(i) * (w - 1)))
    const y = Math.min(h - 1, Math.round((1 - uv.getY(i)) * (h - 1)))
    const k = y * w + x
    const dentro = THREE.MathUtils.smoothstep((borda[k] - 0.5) * 2, 0, 0.6)
    p.setZ(i, dentro * (0.012 + 0.016 * altura[k]))
  }
  geo.computeVertexNormals()
  material.map = t.cor
  material.normalMap = t.normal
  material.normalScale.set(0.35, 0.35)
  material.alphaTest = 0.5
  material.needsUpdate = true
  const g = new THREE.Group()
  g.name = 'figura'
  const frente = malha('figura-frente', geo, material)
  // A face de trás é a mesma malha espelhada em z (o three.js inverte a ordem dos triângulos sozinho)
  const tras = malha('figura-tras', geo, material)
  tras.scale.z = -1
  frente.userData.explodeWithParent = tras.userData.explodeWithParent = true
  g.add(frente, tras)
  return { grupo: g, texturas: [t.cor, t.altura, t.normal] }
}

export function criarEstetica(reduzido: boolean, aoMudar: (indice: number) => void = () => {}): Peca & { mudarAcabamento: (i?: number) => number } {
  const grupo = new THREE.Group()
  const celular = window.matchMedia('(pointer: coarse)').matches

  // Base de pedra preta polida com uma placa de latão gravada na frente
  const base = malha(
    'base',
    new RoundedBoxGeometry(BASE.l, BASE.a, BASE.p, 4, 0.03),
    new THREE.MeshPhysicalMaterial({ color: 0x0b0a0a, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 }),
  )
  base.position.y = BASE.a / 2
  grupo.add(base)
  const placaMat = ouro(0.3)
  const placa = malha('placa', new RoundedBoxGeometry(0.9, 0.1, 0.012, 2, 0.004), placaMat)
  placa.position.set(0, BASE.a / 2, BASE.p / 2 + 0.004)
  placa.userData.explodeWithParent = true
  grupo.add(placa)
  // Gravação: as letras afundadas ficam escuras no latão
  const gravacao = letreiro('LEIDE HAIR · ESTÉTICA', { largura: 1024, altura: 112, fonte: '400 64px "Instrument Serif", Georgia, serif', espaco: 14, cor: '#000000' })
  const letras = malha('placa-letras', new THREE.PlaneGeometry(0.86, 0.094), new THREE.MeshStandardMaterial({ map: gravacao, transparent: true, opacity: 0.75, roughness: 0.6, depthWrite: false }))
  letras.position.set(0, BASE.a / 2, BASE.p / 2 + 0.0112)
  letras.userData.explodeWithParent = true
  grupo.add(letras)

  // Bloco de cristal com quinas arredondadas e um leve arco-íris nas bordas
  const cristal = malha(
    'cristal',
    new RoundedBoxGeometry(BLOCO.l, BLOCO.a, BLOCO.p, 6, 0.045),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.02,
      transmission: 1,
      thickness: BLOCO.p,
      ior: 1.52,
      dispersion: celular ? 0 : 0.35,
      attenuationColor: new THREE.Color(0xeef3f2),
      attenuationDistance: 3,
      specularIntensity: 1,
      envMapIntensity: 1.6,
    }),
  )
  cristal.position.y = BASE.a + BLOCO.a / 2
  grupo.add(cristal)

  // Ouro da figura: a cor vem do acabamento escolhido
  const figuraMat = new THREE.MeshPhysicalMaterial({ color: ACABAMENTOS[0].cor, metalness: 1, roughness: 0.16, clearcoat: 0.3, clearcoatRoughness: 0.15, side: THREE.FrontSide })
  let figura: Awaited<ReturnType<typeof criarFigura>> | null = null
  let descartado = false
  const pronta = criarFigura(figuraMat, celular)
    .then((f) => {
      if (descartado) return f.texturas.forEach((x) => x.dispose())
      figura = f
      f.grupo.position.y = BASE.a + BLOCO.a / 2 + 0.01
      f.grupo.traverse((o) => (o.castShadow = o.receiveShadow = true))
      grupo.add(f.grupo)
    })
    .catch(() => {})

  // Luz que passa por cima do ouro a cada troca de acabamento
  const passada = new THREE.PointLight(0xffe2b8, 0, 2.2, 2)
  grupo.add(passada)
  let varredura = 1
  let indice = 0
  const corAlvo = new THREE.Color(ACABAMENTOS[0].cor)
  let rugAlvo = ACABAMENTOS[0].rugosidade

  function mudarAcabamento(i?: number) {
    indice = i ?? (indice + 1) % ACABAMENTOS.length
    corAlvo.setHex(ACABAMENTOS[indice].cor)
    rugAlvo = ACABAMENTOS[indice].rugosidade
    if (reduzido) {
      figuraMat.color.copy(corAlvo)
      figuraMat.roughness = rugAlvo
    } else varredura = 0
    aoMudar(indice)
    return indice
  }

  // O ouro da figura reflete a mesma sala quente do relevo do topo: as faces chapadas ficam douradas,
  // em vez de refletirem o fundo escuro do estúdio
  let salaOuro: THREE.Texture | null = null
  return {
    grupo,
    pronta,
    preparar(renderer) {
      if (salaOuro) return
      const pm = new THREE.PMREMGenerator(renderer)
      salaOuro = pm.fromScene(salaDoRelevo(), 0.04).texture
      pm.dispose()
      ;[figuraMat, placaMat].forEach((m) => {
        m.envMap = salaOuro
        m.envMapIntensity = 0.95
        m.needsUpdate = true
      })
    },
    enquadramento: { distancia: 6.8, alvoY: 0.72, elevacao: 0.1 },
    mudarAcabamento,
    tocar: () => mudarAcabamento(),
    reiniciar() {
      indice = 0
      corAlvo.setHex(ACABAMENTOS[0].cor)
      rugAlvo = ACABAMENTOS[0].rugosidade
      figuraMat.color.copy(corAlvo)
      figuraMat.roughness = rugAlvo
      varredura = 1
    },
    atualizar(dt) {
      figuraMat.color.lerp(corAlvo, Math.min(1, dt * 3))
      figuraMat.roughness += (rugAlvo - figuraMat.roughness) * Math.min(1, dt * 3)
      if (varredura < 1) {
        varredura = Math.min(1, varredura + dt / 1.4)
        const k = varredura
        passada.position.set(THREE.MathUtils.lerp(-1.1, 1.1, k), BASE.a + BLOCO.a * 0.75, BLOCO.p / 2 + 0.35)
        passada.intensity = Math.sin(k * Math.PI) * 3
      } else passada.intensity = 0
    },
    descartar: () => {
      descartado = true
      figura?.texturas.forEach((x) => x.dispose())
      salaOuro?.dispose()
      liberar(grupo)
    },
  }
}
