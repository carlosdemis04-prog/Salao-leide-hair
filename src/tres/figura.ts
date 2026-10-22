// Texturas da figura da logo (cor, altura e normais), feitas a partir do desenho no navegador.
// Usadas pelo relevo do topo e pela peça de ouro da área Serviços.
// A conta é pesada (meio segundo ou mais), então roda num worker; o resultado fica guardado,
// e voltar para a mesma peça não refaz nada.
import * as THREE from 'three'
import { calcularFigura, type Campos, type OpcoesFigura } from './figuraCalculo'

const guardados = new Map<string, Promise<Campos>>()

function noWorker(fonte: string, largura: number, opcoes: OpcoesFigura) {
  return new Promise<Campos>((ok, falha) => {
    const w = new Worker(new URL('./figura.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<{ ok: boolean; r?: Campos; erro?: string }>) => {
      w.terminate()
      if (e.data.ok && e.data.r) ok(e.data.r)
      else falha(new Error(e.data.erro))
    }
    w.onerror = (e) => {
      w.terminate()
      falha(e)
    }
    w.postMessage({ fonte: new URL(fonte, location.href).href, largura, opcoes })
  })
}

// Navegador sem worker com canvas: faz a conta aqui mesmo
async function naPagina(fonte: string, largura: number, opcoes: OpcoesFigura) {
  const img = new Image()
  img.src = fonte
  await img.decode()
  const w = largura
  const h = Math.round((largura * img.naturalHeight) / img.naturalWidth)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  return calcularFigura(ctx.getImageData(0, 0, w, h).data, w, h, opcoes)
}

export function camposDaFigura(fonte: string, largura: number, opcoes: OpcoesFigura = {}) {
  const chave = `${fonte}|${largura}|${opcoes.cinza ? 1 : 0}|${opcoes.borda ?? 0}`
  let p = guardados.get(chave)
  if (!p) {
    const comWorker = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined'
    p = (comWorker ? noWorker(fonte, largura, opcoes).catch(() => naPagina(fonte, largura, opcoes)) : naPagina(fonte, largura, opcoes)).catch((e) => {
      guardados.delete(chave)
      throw e
    })
    guardados.set(chave, p)
  }
  return p
}

export async function texturasDaFigura(fonte: string, largura: number, opcoes: OpcoesFigura = {}) {
  const campos = await camposDaFigura(fonte, largura, opcoes)
  const { w, h } = campos
  const tex = (d: Uint8Array, srgb = false) => {
    const t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat)
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.magFilter = THREE.LinearFilter
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.generateMipmaps = true
    t.anisotropy = 8
    t.needsUpdate = true
    return t
  }
  return { aspecto: w / h, cor: tex(campos.cor, true), altura: tex(campos.alt), normal: tex(campos.nor), campos }
}
