// Microtextura feita em código: um relevo de ruído bem fino que quebra os reflexos como num metal
// de verdade, e um escovado em linhas para o aço. São criadas uma vez e usadas por todas as peças.
import * as THREE from 'three'

const N = 256

// Ruído de valor que repete nas bordas, para a textura ladrilhar sem emenda
function ruido(celulas: number, semente: number) {
  const grade = new Float32Array(celulas * celulas)
  let s = semente
  for (let i = 0; i < grade.length; i++) {
    s = (s * 16807) % 2147483647
    grade[i] = s / 2147483647
  }
  const v = (x: number, y: number) => grade[((y + celulas) % celulas) * celulas + ((x + celulas) % celulas)]
  const out = new Float32Array(N * N)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const fx = (x / N) * celulas
      const fy = (y / N) * celulas
      const ix = Math.floor(fx)
      const iy = Math.floor(fy)
      const tx = fx - ix
      const ty = fy - iy
      const sx = tx * tx * (3 - 2 * tx)
      const sy = ty * ty * (3 - 2 * ty)
      const a = v(ix, iy) + (v(ix + 1, iy) - v(ix, iy)) * sx
      const b = v(ix, iy + 1) + (v(ix + 1, iy + 1) - v(ix, iy + 1)) * sx
      out[y * N + x] = a + (b - a) * sy
    }
  }
  return out
}

// Converte uma altura em mapa de normais (diferença entre vizinhos, com repetição nas bordas)
function normais(altura: Float32Array, forca: number) {
  const dados = new Uint8Array(N * N * 4)
  const h = (x: number, y: number) => altura[((y + N) % N) * N + ((x + N) % N)]
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * forca
      const dy = (h(x, y + 1) - h(x, y - 1)) * forca
      const l = Math.hypot(dx, dy, 1)
      const i = (y * N + x) * 4
      dados[i] = (-dx / l) * 127.5 + 127.5
      dados[i + 1] = (-dy / l) * 127.5 + 127.5
      dados[i + 2] = (1 / l) * 127.5 + 127.5
      dados[i + 3] = 255
    }
  }
  return dados
}

function textura(dados: Uint8Array, repetir: number, cor = false) {
  const t = new THREE.DataTexture(dados, N, N, THREE.RGBAFormat)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repetir, repetir)
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.anisotropy = 4
  if (cor) t.colorSpace = THREE.NoColorSpace
  t.needsUpdate = true
  return t
}

let cache: { metal: THREE.DataTexture; rugosidade: THREE.DataTexture; escovado: THREE.DataTexture } | null = null

export function microtexturas() {
  if (cache) return cache
  // Três escalas de ruído somadas: martelado leve, poros e um pó bem fino
  const a = ruido(8, 11)
  const b = ruido(32, 23)
  const c = ruido(96, 37)
  const relevo = new Float32Array(N * N)
  for (let i = 0; i < relevo.length; i++) relevo[i] = a[i] * 0.5 + b[i] * 0.35 + c[i] * 0.15
  // Rugosidade varia pouco, mas o suficiente para o brilho não parecer plástico pintado
  const rug = new Uint8Array(N * N * 4)
  for (let i = 0; i < N * N; i++) {
    const v = Math.min(255, Math.max(0, 226 + (b[i] - 0.5) * 60 + (c[i] - 0.5) * 40))
    rug[i * 4] = rug[i * 4 + 1] = rug[i * 4 + 2] = v
    rug[i * 4 + 3] = 255
  }
  // Escovado: riscos finos numa direção só (cada linha quase não muda ao longo de x, e repete na borda)
  const linhas = new Float32Array(N * N)
  const r = ruido(128, 53)
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) linhas[y * N + x] = r[y * N + Math.round(8 + 7 * Math.sin((x / N) * Math.PI * 2))]
  cache = {
    metal: textura(normais(relevo, 2.2), 3),
    rugosidade: textura(rug, 3, true),
    escovado: textura(normais(linhas, 1.4), 2),
  }
  return cache
}

let cacheFuros: { cor: THREE.DataTexture; normal: THREE.DataTexture } | null = null

// Chapa perfurada (grade de filtro): furos redondos em colmeia, com a borda do furo chanfrada
export function chapaPerfurada() {
  if (cacheFuros) return cacheFuros
  const altura = new Float32Array(N * N)
  const cor = new Uint8Array(N * N * 4)
  // 8 furos por linha; linhas alternadas deslocadas meio passo, e a altura da célula fecha a repetição
  const colunas = 8
  const passo = N / colunas
  const linhas = 8
  const passoY = N / linhas
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let d = 1e9
      for (let ly = -1; ly <= linhas; ly++) {
        const cy = (ly + 0.5) * passoY
        const desl = ly % 2 === 0 ? 0 : passo / 2
        for (let lx = -1; lx <= colunas; lx++) {
          const cx = (lx + 0.5) * passo + desl
          d = Math.min(d, Math.hypot(x - cx, y - cy))
        }
      }
      const r = passo * 0.32
      // 0 no fundo do furo, 1 na chapa, com uma rampa curta que vira o chanfro
      const k = Math.min(1, Math.max(0, (d - r) / (passo * 0.08)))
      altura[y * N + x] = k
      const v = d < r ? 6 : 255
      const i = (y * N + x) * 4
      cor[i] = cor[i + 1] = cor[i + 2] = v
      cor[i + 3] = 255
    }
  const c = textura(cor, 4, false)
  c.colorSpace = THREE.SRGBColorSpace
  cacheFuros = { cor: c, normal: textura(normais(altura, 3), 4) }
  return cacheFuros
}
