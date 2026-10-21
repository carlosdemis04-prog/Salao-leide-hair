// Ponto de entrada das peças 3D. A página carrega este arquivo só quando a área Serviços chega perto,
// então o three.js não pesa na abertura do site.
import { criarPalco } from './palco'
import { criarCabelo } from './cabelo'
import { criarUnhas } from './unhas'
import { criarEstetica } from './estetica'

export type Aba = 'cabelo' | 'unhas' | 'estetica'

export type Avisos = {
  secador: (ligado: boolean) => void
  acabamento: (indice: number) => void
}

export function montarVitrine(canvas: HTMLCanvasElement, reduzido: boolean, avisos: Avisos) {
  const palco = criarPalco(canvas, { reduzido })
  let cabelo: ReturnType<typeof criarCabelo> | null = null
  let unhas: ReturnType<typeof criarUnhas> | null = null
  let estetica: ReturnType<typeof criarEstetica> | null = null

  return {
    palco,
    mostrar(aba: Aba) {
      cabelo = unhas = estetica = null
      if (aba === 'cabelo') palco.mostrar((cabelo = criarCabelo(reduzido, avisos.secador)))
      else if (aba === 'unhas') palco.mostrar((unhas = criarUnhas(reduzido)))
      else palco.mostrar((estetica = criarEstetica(reduzido, avisos.acabamento)))
    },
    ligarSecador: () => cabelo?.ligarSecador(),
    cortar: () => cabelo?.cortar(),
    mudarCor: (cor: number) => unhas?.mudarCor(cor),
    mudarAcabamento: (i?: number) => estetica?.mudarAcabamento(i),
  }
}

export type Vitrine = ReturnType<typeof montarVitrine>

// Sem WebGL a página mostra a figura da logo no lugar
export function temWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}
