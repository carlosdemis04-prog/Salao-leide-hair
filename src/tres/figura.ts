// Texturas da figura da logo (cor, altura e normais), feitas a partir do desenho no navegador.
// Usadas pelo relevo do topo e pela peça de ouro da área Serviços.
import * as THREE from "three";

// Desfoque de caixa separável, três passadas (fica perto de um gaussiano)
export function desfocar(
  src: Float32Array,
  w: number,
  h: number,
  raio: number,
) {
  const a = src.slice();
  const b = new Float32Array(src.length);
  const r = Math.max(1, Math.round(raio));
  const k = 1 / (2 * r + 1);
  for (let passada = 0; passada < 3; passada++) {
    for (let y = 0; y < h; y++) {
      const o = y * w;
      let soma = a[o] * (r + 1);
      for (let i = 1; i <= r; i++) soma += a[o + Math.min(i, w - 1)];
      for (let x = 0; x < w; x++) {
        b[o + x] = soma * k;
        soma += a[o + Math.min(x + r + 1, w - 1)] - a[o + Math.max(x - r, 0)];
      }
    }
    for (let x = 0; x < w; x++) {
      let soma = b[x] * (r + 1);
      for (let i = 1; i <= r; i++) soma += b[Math.min(i, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = soma * k;
        soma +=
          b[Math.min(y + r + 1, h - 1) * w + x] - b[Math.max(y - r, 0) * w + x];
      }
    }
  }
  return a;
}

// Gera as texturas do relevo a partir do desenho: cor (com os sulcos escurecidos), altura e normais
export async function texturasDaFigura(
  fonte: string,
  largura: number,
  opcoes: { cinza?: boolean } = {},
) {
  const img = new Image();
  img.src = fonte;
  await img.decode();
  const w = largura;
  const h = Math.round((largura * img.naturalHeight) / img.naturalWidth);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;

  const alfa = new Float32Array(w * h);
  const luz = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    // O desenho original tem um alfa suave (brilho); o relevo precisa de uma forma sólida
    const a = px[i * 4 + 3] / 255;
    const k = Math.min(1, Math.max(0, (a - 0.22) / 0.3));
    alfa[i] = k * k * (3 - 2 * k);
    luz[i] =
      (px[i * 4] * 0.3 + px[i * 4 + 1] * 0.55 + px[i * 4 + 2] * 0.15) / 255;
  }
  // Mechas finas ganham uma crista estreita; o rosto e o disco do cabelo ficam abaulados
  const fino = desfocar(alfa, w, h, w * 0.0035);
  const largo = desfocar(alfa, w, h, w * 0.014);
  // As formas grandes (o disco do cabelo, o rosto) ganham uma curvatura ampla, senão viram um espelho chapado
  const amplo = desfocar(alfa, w, h, w * 0.05);
  const altura = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++)
    altura[i] = Math.min(
      1,
      fino[i] * 0.4 + Math.sqrt(Math.max(0, largo[i])) * 0.2 + amplo[i] * 0.4,
    );
  // Onde a altura em volta é maior que a do ponto, é sulco: escurece um pouco
  const entorno = desfocar(altura, w, h, w * 0.01);

  const cor = new Uint8Array(w * h * 4);
  const alt = new Uint8Array(w * h * 4);
  const nor = new Uint8Array(w * h * 4);
  const H = (x: number, y: number) =>
    altura[
      Math.min(Math.max(y, 0), h - 1) * w + Math.min(Math.max(x, 0), w - 1)
    ];
  const forca = w / 260;
  for (let y = 0; y < h; y++) {
    // As texturas do three.js começam de baixo; a imagem, de cima
    const linha = (h - 1 - y) * w;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const j = (linha + x) * 4;
      // Ouro com a variação do desenho original (bem leve, quem faz o brilho é a luz),
      // escurecido no fundo dos sulcos entre as mechas
      const sulco = Math.min(1, Math.max(0, (entorno[i] - altura[i]) * 3.2));
      const v = (0.86 + (luz[i] - 0.6) * 0.35) * (1 - sulco * 0.6);
      // Em cinza, quem dá a cor é o material (para trocar o acabamento sem refazer a textura)
      const [r, g, b] = opcoes.cinza ? [255, 255, 255] : [226, 176, 84];
      cor[j] = Math.min(255, r * v);
      cor[j + 1] = Math.min(255, g * v);
      cor[j + 2] = Math.min(255, b * v);
      cor[j + 3] = alfa[i] * 255;
      alt[j] = alt[j + 1] = alt[j + 2] = altura[i] * 255;
      alt[j + 3] = 255;
      const gx = (H(x + 1, y) - H(x - 1, y)) * forca;
      const gy = (H(x, y - 1) - H(x, y + 1)) * forca;
      const l = Math.hypot(gx, gy, 1);
      nor[j] = (-gx / l) * 127.5 + 127.5;
      nor[j + 1] = (-gy / l) * 127.5 + 127.5;
      nor[j + 2] = (1 / l) * 127.5 + 127.5;
      nor[j + 3] = 255;
    }
  }
  const tex = (d: Uint8Array, srgb = false) => {
    const t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  };
  return {
    aspecto: w / h,
    cor: tex(cor, true),
    altura: tex(alt),
    normal: tex(nor),
    campos: { alfa, altura, w, h },
  };
}
