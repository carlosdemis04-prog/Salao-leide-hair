// Ponto de entrada das peças 3D. A página carrega este arquivo só quando a área Serviços chega perto,
// então o three.js não pesa na abertura do site.
import { criarPalco, type Peca } from './palco'
import { criarCabelo } from './cabelo'
import { criarUnhas } from './unhas'
import { criarEstetica } from './estetica'

export type Aba = 'cabelo' | 'unhas' | 'estetica'

export type Avisos = {
  secador: (ligado: boolean) => void
  acabamento: (indice: number) => void
}

const ORDEM: Aba[] = ['cabelo', 'unhas', 'estetica']

export function montarVitrine(canvas: HTMLCanvasElement, reduzido: boolean, avisos: Avisos) {
  const palco = criarPalco(canvas, { reduzido })
  // Cada peça é montada uma vez só e fica guardada: trocar de aba (ou rolar pelos capítulos) não refaz nada
  let cabelo: ReturnType<typeof criarCabelo> | null = null
  let unhas: ReturnType<typeof criarUnhas> | null = null
  let estetica: ReturnType<typeof criarEstetica> | null = null
  let atual: Aba | null = null
  const peca = (aba: Aba): Peca => {
    if (aba === 'cabelo') return (cabelo ??= criarCabelo(reduzido, avisos.secador))
    if (aba === 'unhas') return (unhas ??= criarUnhas(reduzido))
    return (estetica ??= criarEstetica(reduzido, avisos.acabamento))
  }

  // Com a primeira peça já em cena, monta as outras nos intervalos livres do navegador,
  // uma por vez, e deixa os shaders compilados para a troca ser só o corte
  let descartada = false
  const folga = (f: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(f, { timeout: 2500 }) : setTimeout(f, 400))
  function prepararProxima() {
    if (descartada) return
    const falta = ORDEM.find((a) => !{ cabelo, unhas, estetica }[a])
    if (!falta) return
    folga(() => {
      if (descartada) return
      palco
        .aquecer(peca(falta))
        .catch(() => {})
        .then(() => setTimeout(prepararProxima, 300))
    })
  }

  return {
    palco,
    mostrar(aba: Aba) {
      const primeira = !atual
      atual = aba
      palco.mostrar(peca(aba))
      if (primeira) setTimeout(prepararProxima, 1200)
    },
    ligarSecador: () => (atual === 'cabelo' ? cabelo?.ligarSecador() : undefined),
    cortar: () => (atual === 'cabelo' ? cabelo?.cortar() : undefined),
    mudarCor: (cor: number) => (atual === 'unhas' ? unhas?.mudarCor(cor) : undefined),
    mudarAcabamento: (i?: number) => (atual === 'estetica' ? estetica?.mudarAcabamento(i) : undefined),
    descartar() {
      descartada = true
      palco.descartar()
      ;[cabelo, unhas, estetica].forEach((p) => p?.descartar?.())
    },
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
