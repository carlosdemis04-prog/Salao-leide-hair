import { useCallback, useState } from 'react'
import { supabase } from '../supabase'

// Questionário da aba Ofertas: a cliente conta um pouco sobre ela e ganha 5% de desconto.
// As respostas vão para a ficha dela no painel da Leide (migração 0016). O cupom fica guardado
// neste celular para ela mostrar no salão.

export type Pergunta = { chave: string; texto: string; opcoes: string[] }

// As 7 perguntas além de nome, e-mail, WhatsApp, aniversário e serviços.
// "Como conheceu" usa as mesmas opções da ficha do painel.
export const PERGUNTAS: Pergunta[] = [
  {
    chave: 'origem',
    texto: 'Como você conheceu o salão?',
    opcoes: ['Instagram', 'Indicação de amiga', 'Passou na frente', 'Google', 'WhatsApp', 'Outro'],
  },
  {
    chave: 'frequencia',
    texto: 'De quanto em quanto tempo você vai ao salão?',
    opcoes: ['Toda semana', 'A cada 15 dias', 'Uma vez por mês', 'A cada 2 ou 3 meses', 'Só em ocasiões especiais'],
  },
  {
    chave: 'cabelo',
    texto: 'Como é o seu cabelo hoje?',
    opcoes: ['Liso', 'Ondulado', 'Cacheado', 'Crespo', 'Com química ou coloração'],
  },
  {
    chave: 'horario',
    texto: 'Qual o melhor horário para você?',
    opcoes: ['Manhã', 'Hora do almoço', 'Tarde', 'Fim da tarde', 'Sábado'],
  },
  {
    chave: 'importa',
    texto: 'O que mais importa para você num salão?',
    opcoes: ['Preço justo', 'Qualidade do resultado', 'Atendimento carinhoso', 'Horário fácil', 'Ambiente gostoso'],
  },
  {
    chave: 'ocasiao',
    texto: 'Tem alguma data especial chegando?',
    opcoes: ['Casamento', 'Formatura', 'Aniversário', 'Viagem', 'Festa', 'Nada por agora'],
  },
  {
    chave: 'contato',
    texto: 'Como prefere receber novidades e ofertas?',
    opcoes: ['WhatsApp', 'E-mail', 'Instagram', 'Prefiro não receber'],
  },
]

export type Respostas = Record<string, string>

export type Envio = {
  nome: string
  email: string
  phone: string
  aniversario: string
  servicos: string[]
  respostas: Respostas
  consentimento: boolean
}

export type CupomQuestionario = { codigo: string; desconto: number; expira_em: string; nome: string }

const CHAVE = 'leide-app-questionario'

function guardado(): CupomQuestionario | null {
  try {
    const t = localStorage.getItem(CHAVE)
    return t ? (JSON.parse(t) as CupomQuestionario) : null
  } catch {
    return null
  }
}

const ERROS: Record<string, string> = {
  nome_invalido: 'Confira o seu nome.',
  email_invalido: 'Confira o seu e-mail.',
  telefone_invalido: 'Confira o seu WhatsApp, com DDD.',
  aniversario_invalido: 'Confira a data do seu aniversário.',
  sem_consentimento: 'Para ganhar o desconto, marque que concorda em guardar as respostas.',
  ja_respondeu: 'Esse WhatsApp já respondeu o questionário. Seu cupom de 5% está com a Leide: é só pedir no salão.',
  muitas_respostas: 'Muita gente respondendo agora. Tente de novo daqui a pouco.',
}

export function useQuestionario() {
  const [cupom, setCupom] = useState<CupomQuestionario | null>(guardado)

  const responder = useCallback(async (e: Envio): Promise<string | null> => {
    if (!supabase) return 'O app está sem conexão com o banco.'
    const { data, error } = await supabase.rpc('questionario_responder', {
      p_nome: e.nome.trim(),
      p_email: e.email.trim(),
      p_phone: e.phone,
      p_aniversario: e.aniversario,
      p_servicos: e.servicos,
      p_respostas: e.respostas,
      p_consentimento: e.consentimento,
    })
    if (error) {
      const chave = Object.keys(ERROS).find((k) => error.message.includes(k))
      if (chave) return ERROS[chave]
      if (error.message.includes('questionario_responder')) return 'O questionário ainda não está ligado. Tente de novo mais tarde.'
      return 'Não foi possível enviar. Confira a internet e tente de novo.'
    }
    const c = { ...(data as Omit<CupomQuestionario, 'nome'>), nome: e.nome.trim().split(' ')[0] }
    try {
      localStorage.setItem(CHAVE, JSON.stringify(c))
    } catch {
      /* sem armazenamento: o cupom aparece só agora (e a Leide também vê no painel) */
    }
    setCupom(c)
    return null
  }, [])

  return { cupom, responder }
}
