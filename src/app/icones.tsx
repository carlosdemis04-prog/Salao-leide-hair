import type { SVGProps } from 'react'

// Ícones do app no mesmo traço fino dos ícones do site (src/icons.tsx)
type P = SVGProps<SVGSVGElement>

function Base({ children, ...props }: P) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  )
}

export const InicioIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5h-6v5.5H5.5A1.5 1.5 0 0 1 4 19z" />
  </Base>
)

export const AgendarIcon = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4M9.5 15l2 2 3.5-3.5" />
  </Base>
)

export const OfertaIcon = (p: P) => (
  <Base {...p}>
    <path d="M3.5 12.6V5a1.5 1.5 0 0 1 1.5-1.5h7.6a1.5 1.5 0 0 1 1 .44l6.9 6.9a1.5 1.5 0 0 1 0 2.12l-7.6 7.6a1.5 1.5 0 0 1-2.12 0l-6.9-6.9a1.5 1.5 0 0 1-.38-1.06Z" />
    <circle cx="8.3" cy="8.3" r="1.4" />
  </Base>
)

export const EventoIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 3.5l2.4 5 5.4.6-4 3.7 1.1 5.4L12 15.5l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z" />
  </Base>
)

export const ContatoIcon = (p: P) => (
  <Base {...p}>
    <path d="M20 11.5a7.5 7.5 0 0 1-11 6.6L4 19.5l1.4-4.5A7.5 7.5 0 1 1 20 11.5Z" />
    <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" strokeWidth={2.4} />
  </Base>
)

export const TelefoneIcon = (p: P) => (
  <Base {...p}>
    <path d="M5 4h3.5l1.7 4.3-2.2 1.4a11 11 0 0 0 6.3 6.3l1.4-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4Z" />
  </Base>
)

export const FecharIcon = (p: P) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
)

export const ServicosIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </Base>
)

export const UnhaIcon = (p: P) => (
  <Base {...p}>
    <path d="M9 21v-9a3 3 0 0 1 6 0v9" />
    <path d="M10 6.5 12 3l2 3.5V9h-4z" />
  </Base>
)

export const FlorIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="2.4" />
    <path d="M12 9.6C10 7 10 4.5 12 3c2 1.5 2 4 0 6.6ZM12 14.4c2 2.6 2 5.1 0 6.6-2-1.5-2-4 0-6.6ZM9.6 12C7 14 4.5 14 3 12c1.5-2 4-2 6.6 0ZM14.4 12c2.6-2 5.1-2 6.6 0-1.5 2-4 2-6.6 0Z" />
  </Base>
)

export const CopiarIcon = (p: P) => (
  <Base {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2.2" />
    <path d="M15.5 8.5V6.2A1.7 1.7 0 0 0 13.8 4.5H6.2A1.7 1.7 0 0 0 4.5 6.2v7.6a1.7 1.7 0 0 0 1.7 1.7h2.3" />
  </Base>
)

export const CompartilharIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 15V4M8 7.5 12 3.5l4 4" />
    <path d="M7 10.5H6a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1" />
  </Base>
)

export const PresenteIcon = (p: P) => (
  <Base {...p}>
    <rect x="4" y="9" width="16" height="11.5" rx="1.8" />
    <path d="M3 9h18M12 9v11.5M12 9c-1.5-3.8-6-4.6-6-1.8C6 9 12 9 12 9Zm0 0c1.5-3.8 6-4.6 6-1.8C18 9 12 9 12 9Z" />
  </Base>
)
