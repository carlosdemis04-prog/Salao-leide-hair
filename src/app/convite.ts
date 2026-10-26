import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'

// Campanha "Indique amigas": cada cliente tem um link de convite (/app?convite=CODIGO).
// A amiga que abre o link e agenda pela primeira vez ganha 10%; a cada 3 amigas, quem convidou ganha 30%.
// As contas ficam no banco (migração 0011); aqui só mostramos e avisamos quando a amiga agenda.

export type CupomConvite = {
  codigo: string
  tipo: 'boas_vindas' | 'madrinha'
  desconto: number
  expira_em: string
  usado_em: string | null
}

export type Amiga = { nome: string; quando: string; situacao: 'agendou' | 'veio' | 'cancelou' }

export type MeuConvite =
  | { participando: false }
  | { participando: true; codigo: string; nome: string | null; validas: number; amigas: Amiga[]; cupons: CupomConvite[] }

export const POR_PREMIO = 3

const CHAVE_TOKEN = 'leide-app-lady'
const CHAVE_CONVITE = 'leide-app-convite'

function token() {
  try {
    return localStorage.getItem(CHAVE_TOKEN)
  } catch {
    return null
  }
}

export function linkConvite(codigo: string) {
  return `${location.origin}/app?convite=${codigo}`
}

// Abriu o app pelo link de uma amiga: guarda o código até ela agendar e limpa o endereço
function codigoRecebido() {
  const url = new URL(location.href)
  const doLink = url.searchParams.get('convite')?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  if (doLink) {
    url.searchParams.delete('convite')
    history.replaceState(history.state, '', url.pathname + url.search + url.hash)
    try {
      localStorage.setItem(CHAVE_CONVITE, doLink)
    } catch {
      /* sem armazenamento: o convite vale só nesta visita */
    }
    return { codigo: doLink, agora: true }
  }
  try {
    const guardado = localStorage.getItem(CHAVE_CONVITE)
    return guardado ? { codigo: guardado, agora: false } : null
  } catch {
    return null
  }
}

function esquecerConvite() {
  try {
    localStorage.removeItem(CHAVE_CONVITE)
  } catch {
    /* nada a fazer */
  }
}

export function useConvite() {
  // null = carregando; undefined = campanha ainda não existe no banco (migração 0011 não rodada)
  const [meu, setMeu] = useState<MeuConvite | null | undefined>(supabase ? null : undefined)
  // Convite recebido de uma amiga (só aparece a folha de boas-vindas quando acabou de abrir o link)
  const [recebido, setRecebido] = useState(codigoRecebido)
  const [madrinha, setMadrinha] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const t = token()
    if (!supabase) return setMeu(undefined)
    if (!t) return setMeu({ participando: false })
    const { data, error } = await supabase.rpc('convite_meu', { p_token: t })
    setMeu(error ? undefined : (data as MeuConvite))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    if (!recebido || !supabase) return
    supabase.rpc('convite_info', { p_codigo: recebido.codigo }).then(({ data }) => {
      const nome = (data as { nome: string | null } | null)?.nome
      if (data === null) {
        esquecerConvite() // código que não existe
        setRecebido(null)
      } else setMadrinha(nome ?? null)
    })
  }, [recebido])

  // A amiga agendou: conta a indicação e devolve o cupom de 10% dela
  const registrar = useCallback(
    async (reserva: string): Promise<{ cupom: CupomConvite; madrinha: string | null } | null> => {
      if (!recebido || !supabase) return null
      const { data, error } = await supabase.rpc('convite_registrar', { p_codigo: recebido.codigo, p_reserva: reserva })
      if (error) return null // sem internet: tenta de novo na próxima reserva
      esquecerConvite()
      setRecebido(null)
      const r = data as { ok: boolean; cupom?: CupomConvite; madrinha?: string | null }
      return r.ok && r.cupom ? { cupom: r.cupom, madrinha: r.madrinha ?? null } : null
    },
    [recebido],
  )

  return {
    meu,
    carregar,
    registrar,
    convidada: recebido ? { agora: recebido.agora, madrinha } : null,
  }
}

export const validadeFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
