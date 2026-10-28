import { CalendarIcon, PinIcon, WhatsAppIcon } from '../../icons'
import { linkWhats, type Evento } from '../dados'
import { dataCurtaFmt, dataLongaFmt, horaFmt, maiuscula } from '../formato'
import { Mascote } from '../Mascote'
import { Cabecalho, Esqueleto, Folha, Vazio } from '../ui'
import type { MeuConvite } from '../convite'
import { IndiqueCartao } from './Convite'
import type { MinhaFamilia } from '../familia'
import { FamiliaCartao } from './Familia'

function quando(e: Evento) {
  if (!e.starts_at) return 'Com hora marcada pelo WhatsApp'
  const ini = new Date(e.starts_at)
  const fim = e.ends_at ? ` às ${horaFmt.format(new Date(e.ends_at))}` : ''
  return `${maiuscula(dataLongaFmt.format(ini))}, ${horaFmt.format(ini)}${fim}`
}

export function Eventos({
  eventos,
  carregando,
  abrir,
  convite,
  abrirConvite,
  familia,
  abrirFamilia,
}: {
  eventos: Evento[]
  carregando: boolean
  abrir: (e: Evento) => void
  convite: MeuConvite | null | undefined
  abrirConvite: () => void
  familia: MinhaFamilia | null | undefined
  abrirFamilia: () => void
}) {
  return (
    <div className="tela">
      <Cabecalho titulo="Eventos" sub="Dias especiais, cursos e lançamentos" />
      <IndiqueCartao meu={convite} abrir={abrirConvite} />
      <FamiliaCartao familia={familia} abrir={abrirFamilia} />
      {carregando && <Esqueleto linhas={3} />}
      {!carregando && eventos.length === 0 && (
        <Vazio titulo="Nenhum evento marcado" texto="Os próximos eventos do salão vão aparecer aqui. Volte em breve!" />
      )}
      <ul className="lista-cartoes">
        {eventos.map((e) => {
          const d = e.starts_at ? dataCurtaFmt.format(new Date(e.starts_at)).replace('.', '').split(' ') : null
          return (
            <li key={e.id}>
              <button className="cartao evento" onClick={() => abrir(e)}>
                {e.image_url ? (
                  <img src={e.image_url} alt="" loading="lazy" className="cartao-capa" />
                ) : d ? (
                  <span className="cartao-capa data-capa" aria-hidden>
                    <strong>{d[0]}</strong>
                    <span>{d.slice(2).join(' ') || d[1]}</span>
                  </span>
                ) : (
                  <span className="cartao-capa sem-foto" aria-hidden>
                    <Mascote humor="agendar" mini size={56} />
                  </span>
                )}
                <span className="cartao-corpo">
                  <span className="cartao-titulo">{e.title}</span>
                  <span className="cartao-pe">
                    <CalendarIcon /> {quando(e)}
                  </span>
                  {e.spots !== null && <span className="cartao-pe">{e.spots > 0 ? `${e.spots} vagas` : 'Vagas esgotadas'}</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function EventoFolha({ evento, fechar }: { evento: Evento; fechar: () => void }) {
  const esgotado = evento.spots === 0
  const semData = !evento.starts_at
  return (
    <Folha titulo={evento.title} aoFechar={fechar}>
      <div className="detalhe">
        {evento.image_url && <img src={evento.image_url} alt="" className="detalhe-capa" />}
        <h2>{evento.title}</h2>
        <p className="detalhe-linha">
          <CalendarIcon /> {quando(evento)}
        </p>
        {evento.location && (
          <p className="detalhe-linha">
            <PinIcon /> {evento.location}
          </p>
        )}
        {evento.spots !== null && <p className="suave">{esgotado ? 'Vagas esgotadas' : `${evento.spots} vagas`}</p>}
        {evento.description && <p>{evento.description}</p>}
        <a
          className="botao"
          href={linkWhats(
            semData
              ? `Olá! Quero saber sobre "${evento.title}".`
              : esgotado
              ? `Olá! Quero saber se abre vaga no evento "${evento.title}".`
              : `Olá! Quero participar do evento "${evento.title}".`,
          )}
          target="_blank"
          rel="noreferrer"
        >
          <WhatsAppIcon /> {semData ? 'Combinar pelo WhatsApp' : esgotado ? 'Entrar na lista de espera' : 'Quero participar'}
        </a>
        <p className="suave">{semData ? 'A Leide combina tudo com você pelo WhatsApp.' : 'A inscrição é confirmada pela Leide no WhatsApp.'}</p>
      </div>
    </Folha>
  )
}
