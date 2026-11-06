import { useState, type FormEvent } from 'react'
import type { Service } from '../../supabase'
import { validadeFmt } from '../convite'
import { telefone } from '../formato'
import { PresenteIcon } from '../icones'
import { Mascote } from '../Mascote'
import { PERGUNTAS, type CupomQuestionario, type Envio, type Respostas } from '../questionario'
import { depoisDeFechar, Folha } from '../ui'

// Cartão da aba Ofertas: convida para o questionário ou mostra o cupom que ela já ganhou
export function QuestionarioCartao({ cupom, abrir }: { cupom: CupomQuestionario | null; abrir: () => void }) {
  return (
    <button className="cartao questionario-cartao" onClick={abrir}>
      <span className="questionario-cartao-topo">
        <span>
          <span className="questionario-rotulo">{cupom ? 'Seu cupom' : '1 minutinho'}</span>
          <span className="questionario-nome">{cupom ? `${cupom.desconto}% de desconto` : 'Ganhe 5% de desconto'}</span>
        </span>
        <span className="questionario-selo" aria-hidden>
          <strong>5%</strong>
          <span>off</span>
        </span>
      </span>
      <span className="questionario-cartao-texto">
        {cupom
          ? `Código ${cupom.codigo}. Mostre para a Leide no dia do seu horário.`
          : 'Responda algumas perguntas para a Leide conhecer você melhor e ganhe 5% no próximo horário.'}
        <span className="seta" aria-hidden>
          {' '}›
        </span>
      </span>
    </button>
  )
}

// Limite do campo de aniversário (ninguém nasceu amanhã)
const HOJE = new Date().toISOString().slice(0, 10)

const ETAPAS = ['Sobre você', 'Serviços', 'Seu jeito', 'Quase lá']

type Props = {
  services: Service[]
  cupom: CupomQuestionario | null
  responder: (e: Envio) => Promise<string | null>
  agendar: () => void
  fechar: () => void
}

export function QuestionarioFolha({ services, cupom, responder, agendar, fechar }: Props) {
  const [etapa, setEtapa] = useState(0)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [tel, setTel] = useState('')
  const [aniversario, setAniversario] = useState('')
  const [servicos, setServicos] = useState<string[]>([])
  const [respostas, setRespostas] = useState<Respostas>({})
  const [aceite, setAceite] = useState(false)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (cupom) {
    return (
      <Folha titulo="Seu desconto" aoFechar={fechar}>
        <div className="detalhe-servico indique-presente">
          <Mascote humor="festa" size={108} />
          <h2>Obrigada, {cupom.nome}!</h2>
          <p>Suas respostas chegaram para a Leide. Aqui está o seu desconto:</p>
          <div className="cupom">
            <span className="cupom-rotulo">
              <PresenteIcon /> {cupom.desconto}% de desconto
            </span>
            <span className="cupom-codigo">{cupom.codigo}</span>
            <span className="cupom-tempo">Vale até {validadeFmt.format(new Date(cupom.expira_em)).replace('.', '')}</span>
          </div>
          <p className="suave">Mostre este código para a Leide no dia do seu horário. Ele fica guardado aqui em Ofertas.</p>
          <button className="botao" onClick={() => depoisDeFechar(agendar)}>
            Agendar meu horário
          </button>
        </div>
      </Folha>
    )
  }

  const perguntas = etapa === 2 ? PERGUNTAS.slice(0, 4) : etapa === 3 ? PERGUNTAS.slice(4) : []

  function conferir(): string {
    if (etapa === 0) {
      if (nome.trim().length < 2) return 'Escreva o seu nome.'
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return 'Confira o seu e-mail (por exemplo, nome@gmail.com).'
      if (tel.replace(/\D/g, '').length < 10) return 'Confira o seu WhatsApp, com DDD.'
      if (!aniversario) return 'Conte a data do seu aniversário.'
    }
    if (etapa === 1 && servicos.length === 0) return 'Escolha pelo menos um serviço.'
    const falta = perguntas.find((p) => !respostas[p.chave])
    if (falta) return `Responda: ${falta.texto}`
    if (etapa === 3 && !aceite) return 'Para ganhar o desconto, marque que concorda em guardar as respostas.'
    return ''
  }

  async function avancar(e: FormEvent) {
    e.preventDefault()
    const problema = conferir()
    if (problema) return setErro(problema)
    setErro('')
    if (etapa < ETAPAS.length - 1) {
      setEtapa(etapa + 1)
      document.querySelector('.folha')?.scrollTo({ top: 0 })
      return
    }
    setEnviando(true)
    const falhou = await responder({ nome, email, phone: tel, aniversario, servicos, respostas, consentimento: aceite })
    setEnviando(false)
    if (falhou) setErro(falhou)
  }

  const alternar = (s: string) => setServicos((l) => (l.includes(s) ? l.filter((x) => x !== s) : [...l, s]))

  return (
    <Folha titulo="Questionário" aoFechar={fechar}>
      <form className="questionario" onSubmit={avancar} noValidate>
        <div className="questionario-topo">
          <Mascote humor="oferta" mini size={56} />
          <div>
            <h2>Ganhe 5% de desconto</h2>
            <p className="suave">
              Etapa {etapa + 1} de {ETAPAS.length}: {ETAPAS[etapa]}
            </p>
          </div>
        </div>
        <span className="questionario-barra" aria-hidden>
          <i style={{ width: `${((etapa + 1) / ETAPAS.length) * 100}%` }} />
        </span>

        {etapa === 0 && (
          <>
            <label className="campo">
              <span>Seu nome</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" autoCapitalize="words" maxLength={100} />
            </label>
            <label className="campo">
              <span>Seu e-mail (Gmail)</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="nome@gmail.com"
                maxLength={120}
              />
            </label>
            <label className="campo">
              <span>Seu WhatsApp</span>
              <input
                value={tel}
                onChange={(e) => setTel(telefone(e.target.value))}
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="(11) 98765-4321"
              />
            </label>
            <label className="campo">
              <span>Data do seu aniversário</span>
              <input value={aniversario} onChange={(e) => setAniversario(e.target.value)} type="date" min="1920-01-01" max={HOJE} />
            </label>
          </>
        )}

        {etapa === 1 && (
          <fieldset className="pergunta">
            <legend>Quais serviços mais interessam a você?</legend>
            <p className="suave">Pode escolher quantos quiser.</p>
            <div className="opcoes">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`opcao ${servicos.includes(s.name) ? 'marcada' : ''}`}
                  aria-pressed={servicos.includes(s.name)}
                  onClick={() => alternar(s.name)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {perguntas.map((p) => (
          <fieldset key={p.chave} className="pergunta">
            <legend>{p.texto}</legend>
            <div className="opcoes">
              {p.opcoes.map((o) => (
                <button
                  key={o}
                  type="button"
                  className={`opcao ${respostas[p.chave] === o ? 'marcada' : ''}`}
                  aria-pressed={respostas[p.chave] === o}
                  onClick={() => setRespostas((r) => ({ ...r, [p.chave]: o }))}
                >
                  {o}
                </button>
              ))}
            </div>
          </fieldset>
        ))}

        {etapa === 3 && (
          <label className="aceite">
            <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
            <span>
              Concordo que o Leide Hair guarde estas respostas para me atender melhor e me mande novidades, lembretes de
              aniversário e ofertas. Posso pedir para parar ou apagar a qualquer momento. Veja a{' '}
              <a href="/privacidade.html" target="_blank" rel="noreferrer">
                política de privacidade
              </a>
              .
            </span>
          </label>
        )}

        {erro && <p className="aviso-erro">{erro}</p>}

        <div className="questionario-acoes">
          {etapa > 0 && (
            <button type="button" className="botao secundario" onClick={() => (setErro(''), setEtapa(etapa - 1))}>
              Voltar
            </button>
          )}
          <button className="botao" type="submit" disabled={enviando}>
            {etapa < ETAPAS.length - 1 ? 'Continuar' : enviando ? 'Enviando…' : 'Ganhar meus 5%'}
          </button>
        </div>
      </form>
    </Folha>
  )
}
