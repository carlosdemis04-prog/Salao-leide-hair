import { WhatsAppIcon } from '../../icons'
import { linkWhats, type Oferta } from '../dados'
import { preco } from '../formato'
import { Mascote } from '../Mascote'
import { Cabecalho, depoisDeFechar, Esqueleto, Folha, Vazio } from '../ui'

const validadeFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: 'numeric', month: 'long' })

function validade(o: Oferta) {
  return o.valid_until ? `Válida até ${validadeFmt.format(new Date(`${o.valid_until}T12:00:00Z`))}` : null
}

function Precos({ o }: { o: Oferta }) {
  if (o.price_cents === null) return null
  return (
    <span className="oferta-precos">
      {o.original_price_cents !== null && o.original_price_cents > o.price_cents && (
        <s aria-label={`De ${preco(o.original_price_cents)}`}>{preco(o.original_price_cents)}</s>
      )}
      <strong>{preco(o.price_cents)}</strong>
    </span>
  )
}

export function Ofertas({ ofertas, carregando, abrir }: { ofertas: Oferta[]; carregando: boolean; abrir: (o: Oferta) => void }) {
  return (
    <div className="tela">
      <Cabecalho titulo="Ofertas" sub="Promoções e vantagens do salão" />
      {carregando && <Esqueleto linhas={3} />}
      {!carregando && ofertas.length === 0 && (
        <Vazio
          humor="oferta"
          titulo="Nenhuma oferta agora"
          texto="Quando a Leide lançar uma promoção, ela aparece aqui primeiro."
        >
          <a className="botao secundario" href="https://instagram.com/leidehair_beauty" target="_blank" rel="noreferrer">
            Acompanhar no Instagram
          </a>
        </Vazio>
      )}
      <ul className="lista-cartoes">
        {ofertas.map((o) => (
          <li key={o.id}>
            <button className="cartao oferta" onClick={() => abrir(o)}>
              {o.image_url ? (
                <img src={o.image_url} alt="" loading="lazy" className="cartao-capa" />
              ) : (
                <span className="cartao-capa sem-foto" aria-hidden>
                  <Mascote humor="oferta" mini size={56} />
                </span>
              )}
              <span className="cartao-corpo">
                <span className="cartao-titulo">{o.title}</span>
                {o.description && <span className="cartao-desc">{o.description}</span>}
                <Precos o={o} />
                {validade(o) && <span className="cartao-pe">{validade(o)}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function OfertaFolha({
  oferta,
  fechar,
  agendar,
}: {
  oferta: Oferta
  fechar: () => void
  agendar: (servicoId: string) => void
}) {
  const servicoId = oferta.service_id
  return (
    <Folha titulo={oferta.title} aoFechar={fechar}>
      <div className="detalhe">
        {oferta.image_url && <img src={oferta.image_url} alt="" className="detalhe-capa" />}
        <h2>{oferta.title}</h2>
        <Precos o={oferta} />
        {oferta.description && <p>{oferta.description}</p>}
        {validade(oferta) && <p className="suave">{validade(oferta)}</p>}
        {oferta.conditions && (
          <>
            <h3>Condições</h3>
            <p className="suave">{oferta.conditions}</p>
          </>
        )}
        {servicoId ? (
          <button className="botao" onClick={() => depoisDeFechar(() => agendar(servicoId))}>
            Aproveitar oferta
          </button>
        ) : (
          <a
            className="botao"
            href={linkWhats(`Olá! Quero aproveitar a oferta "${oferta.title}".`)}
            target="_blank"
            rel="noreferrer"
          >
            <WhatsAppIcon /> Aproveitar oferta
          </a>
        )}
      </div>
    </Folha>
  )
}
