import type { BusinessHours } from '../../supabase'
import { ClockIcon, InstagramIcon, PinIcon, WhatsAppIcon } from '../../icons'
import { BAIRRO, ENDERECO, INSTAGRAM, MAPA, WHATSAPP, WHATSAPP_LABEL, linkWhats } from '../dados'
import { horarioTexto } from '../formato'
import { TelefoneIcon } from '../icones'
import { Mascote } from '../Mascote'
import { Cabecalho } from '../ui'

export function Contato({ hours }: { hours: BusinessHours[] }) {
  const horario = horarioTexto(hours)
  return (
    <div className="tela">
      <Cabecalho titulo="Contato" sub="Fale com a Leide em poucos toques" />

      <a className="cartao whats" href={linkWhats('Olá! Vim pelo app do salão.')} target="_blank" rel="noreferrer">
        <span className="whats-icone">
          <WhatsAppIcon />
        </span>
        <span>
          <strong>Conversar no WhatsApp</strong>
          <span className="suave">{WHATSAPP_LABEL}</span>
        </span>
        <Mascote humor="oi" mini size={52} className="whats-mascote" />
      </a>

      <ul className="lista-contato">
        <li>
          <a href={`https://instagram.com/${INSTAGRAM}`} target="_blank" rel="noreferrer">
            <InstagramIcon />
            <span>
              <strong>Instagram</strong>
              <span className="suave">@{INSTAGRAM}</span>
            </span>
          </a>
        </li>
        <li>
          <a href={`tel:+${WHATSAPP}`}>
            <TelefoneIcon />
            <span>
              <strong>Ligar</strong>
              <span className="suave">{WHATSAPP_LABEL}</span>
            </span>
          </a>
        </li>
        <li>
          <a href={MAPA} target="_blank" rel="noreferrer">
            <PinIcon />
            <span>
              <strong>{ENDERECO}</strong>
              <span className="suave">{BAIRRO} · Abrir no mapa</span>
            </span>
          </a>
        </li>
        {horario && (
          <li>
            <div>
              <ClockIcon />
              <span>
                <strong>Horário</strong>
                <span className="suave">{horario}</span>
              </span>
            </div>
          </li>
        )}
      </ul>

      <a className="link site" href="/">
        Ver o site completo do salão
      </a>
      <p className="links-legais">
        <a href="/privacidade.html">Privacidade</a>
        <a href="/cookies.html">Cookies</a>
        <a href="/termos.html">Termos de uso</a>
      </p>
    </div>
  )
}
