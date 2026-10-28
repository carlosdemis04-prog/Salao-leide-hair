import type { Conta } from '../conta'
import { telefone } from '../formato'
import { Mascote } from '../Mascote'
import { depoisDeFechar, Folha } from '../ui'

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.5 5.8c4.4-4 6.8-10 6.8-17.3z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  )
}

// Foto do Google ou a inicial do nome
export function Avatar({ conta, size = 40 }: { conta: Conta; size?: number }) {
  const inicial = (conta.nome ?? conta.email ?? '?').trim().charAt(0).toUpperCase()
  return conta.foto ? (
    <img className="conta-foto" src={conta.foto} alt="" width={size} height={size} referrerPolicy="no-referrer" />
  ) : (
    <span className="conta-foto inicial" style={{ width: size, height: size }} aria-hidden>
      {inicial}
    </span>
  )
}

type Props = {
  conta: Conta | null
  erro: string
  entrar: () => void
  sair: () => Promise<void>
  agendar: () => void
  fechar: () => void
}

export function ContaFolha({ conta, erro, entrar, sair, agendar, fechar }: Props) {
  if (!conta)
    return (
      <Folha titulo="Entrar" aoFechar={fechar}>
        <div className="detalhe-servico">
          <Mascote humor="oi" size={96} />
          <h2>Entre com o Google</h2>
          <p className="suave">
            Seus Lady Points, cupons e convites ficam guardados na sua conta. Trocou de celular? É só entrar de novo.
          </p>
          <button className="botao google" onClick={entrar}>
            <GoogleIcon />
            Continuar com o Google
          </button>
          {erro && <p className="aviso-erro">{erro}</p>}
          <p className="conta-nota">Não precisa de conta para agendar. O login é só para guardar seus pontos.</p>
          <p className="conta-nota">
            Ao continuar, o Google nos envia seu nome, e-mail e foto. Veja a{' '}
            <a href="/privacidade.html" target="_blank" rel="noreferrer">
              política de privacidade
            </a>{' '}
            e os{' '}
            <a href="/termos.html" target="_blank" rel="noreferrer">
              termos de uso
            </a>
            .
          </p>
        </div>
      </Folha>
    )

  return (
    <Folha titulo="Minha conta" aoFechar={fechar}>
      <div className="detalhe-servico">
        <Avatar conta={conta} size={72} />
        <h2>{conta.nome ?? 'Minha conta'}</h2>
        {conta.email && <p className="suave">{conta.email}</p>}
        <div className="cartao conta-whats">
          {conta.telefone ? (
            <p>
              <strong>WhatsApp ligado:</strong> {telefone(conta.telefone)}
              <br />
              <span className="suave">Seus Lady Points e cupons estão guardados nesta conta.</span>
            </p>
          ) : (
            <p>
              <strong>Falta pouco:</strong> agende um horário com esta conta para ligar seu WhatsApp e começar a juntar Lady
              Points.
            </p>
          )}
        </div>
        {!conta.telefone && (
          <button className="botao" onClick={() => depoisDeFechar(agendar)}>
            Agendar horário
          </button>
        )}
        <button className="botao texto" onClick={() => sair().then(() => history.back())}>
          Sair da conta
        </button>
      </div>
    </Folha>
  )
}
