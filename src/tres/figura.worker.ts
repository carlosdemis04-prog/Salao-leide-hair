// Faz a conta do relevo fora da página, para a rolagem e as animações não travarem enquanto ela roda
import { calcularFigura, type OpcoesFigura } from './figuraCalculo'

self.onmessage = async (e: MessageEvent<{ fonte: string; largura: number; opcoes: OpcoesFigura }>) => {
  try {
    const { fonte, largura, opcoes } = e.data
    const bruto = await createImageBitmap(await (await fetch(fonte)).blob())
    const w = largura
    const h = Math.round((largura * bruto.height) / bruto.width)
    const c = new OffscreenCanvas(w, h)
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bruto, 0, 0, w, h)
    bruto.close()
    const r = calcularFigura(ctx.getImageData(0, 0, w, h).data, w, h, opcoes)
    const envio = [r.cor, r.alt, r.nor, r.alfa, r.altura, r.borda].filter((x) => x).map((x) => x!.buffer)
    ;(self as unknown as Worker).postMessage({ ok: true, r }, envio)
  } catch (erro) {
    ;(self as unknown as Worker).postMessage({ ok: false, erro: String(erro) })
  }
}
