// Cada letra numa caixa própria, para a animação subir uma de cada vez
export function Letras({ texto }: { texto: string }) {
  return (
    <>
      {[...texto].map((c, i) =>
        c === ' ' ? (
          <span key={i} className="espaco">
            {' '}
          </span>
        ) : (
          <span key={i} className="letra">
            {c}
          </span>
        ),
      )}
    </>
  )
}
