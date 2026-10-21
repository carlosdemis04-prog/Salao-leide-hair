// Estúdio usado só para os reflexos das peças 3D (vira o mapa de ambiente do palco)
import * as THREE from 'three'

// Sala escura com softboxes, como numa foto de joia
export function estudio() {
  const s = new THREE.Scene()
  s.add(new THREE.Mesh(new THREE.BoxGeometry(24, 14, 24), new THREE.MeshBasicMaterial({ color: 0x050403, side: THREE.BackSide })))
  const painel = (w: number, h: number, cor: number, forca: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(cor).multiplyScalar(forca), side: THREE.DoubleSide }),
    )
    m.position.set(x, y, z)
    m.lookAt(0, 1, 0)
    s.add(m)
  }
  painel(7, 3, 0xfff0da, 4, 0, 9, 2) // caixa grande em cima
  painel(1.4, 8, 0xffd29a, 3, -8, 3, 2) // faixa quente à esquerda
  painel(1.4, 8, 0xfff6ee, 2.2, 8, 3, -2) // faixa fria à direita
  painel(6, 2, 0xf3b8b4, 0.6, 0, 2.5, -10) // rosado atrás
  painel(9, 4, 0xfff4e6, 1.3, 2, 3, 11) // rebatedor grande atrás da câmera
  painel(12, 4, 0xffe9d2, 0.9, 0, -1.5, 10) // rebatedor baixo na frente, para as faces de pé não refletirem só o chão escuro
  return s
}
