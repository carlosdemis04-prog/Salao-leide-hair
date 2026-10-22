import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import { ChevronLeftIcon, ChevronRightIcon } from '../icons'
import { carregarDespesas, mesAnterior, mesDe, nomeDoMes, type Despesa } from './dados'
import { brl, dbError, inputToCents, todayIso } from './util'

export const CATEGORIAS: { key: string; label: string }[] = [
  { key: 'produtos', label: 'Produtos (tintas, esmaltes…)' },
  { key: 'aluguel', label: 'Aluguel' },
  { key: 'contas', label: 'Luz, água, internet' },
  { key: 'equipamentos', label: 'Equipamentos' },
  { key: 'divulgacao', label: 'Divulgação' },
  { key: 'outros', label: 'Outros' },
]
const nomeCategoria = (k: string) => CATEGORIAS.find((c) => c.key === k)?.label.split(' (')[0] ?? k
const reais = (c: number) => brl.format(c / 100)

export default function Despesas() {
  const hoje = todayIso()
  const [mes, setMes] = useState(mesDe(hoje))
  const [lista, setLista] = useState<Despesa[] | null>(null)
  const [erroLista, setErroLista] = useState('')

  const [dia, setDia] = useState(hoje)
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState('produtos')
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)

  const load = useCallback(async () => {
    try {
      setLista(await carregarDespesas(`${mes}-01`, `${mesAnterior(mes, -1)}-01`))
      setErroLista('')
    } catch {
      setLista([])
      setErroLista('Não foi possível carregar as despesas. (Já rodou o arquivo 0009 no Supabase?)')
    }
  }, [mes])

  useEffect(() => {
    load()
  }, [load])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setOk(false)
    const c = inputToCents(valor)
    if (c === 'erro' || c === null || c === 0) return setErro('Digite o valor, por exemplo 150 ou 89,90.')
    setErro('')
    const { error } = await supabase!
      .from('expenses')
      .insert({ spent_on: dia, description: descricao.trim(), category: categoria, amount_cents: c })
    if (error) return setErro(dbError(error))
    setDescricao('')
    setValor('')
    setOk(true)
    setMes(mesDe(dia))
    load()
  }

  async function apagar(d: Despesa) {
    if (!window.confirm(`Apagar "${d.description}" (${reais(d.amount_cents)})?`)) return
    await supabase!.from('expenses').delete().eq('id', d.id)
    load()
  }

  const total = lista?.reduce((s, d) => s + d.amount_cents, 0) ?? 0
  const porCategoria = CATEGORIAS.map((c) => ({
    ...c,
    valor: lista?.filter((d) => d.category === c.key).reduce((s, d) => s + d.amount_cents, 0) ?? 0,
  })).filter((c) => c.valor > 0)

  return (
    <section className="pn-section">
      <h2>Despesas</h2>
      <p className="pn-muted">Anote o que o salão gasta. Assim o Início mostra quanto sobrou de verdade.</p>
      <form className="pn-form pn-box" onSubmit={salvar}>
        <label className="pn-field">
          <span>O que foi</span>
          <input value={descricao} placeholder="Ex.: tintas da semana" onChange={(e) => (setDescricao(e.target.value), setOk(false))} maxLength={120} required />
        </label>
        <div className="pn-grid2">
          <label className="pn-field">
            <span>Valor (R$)</span>
            <input inputMode="decimal" value={valor} placeholder="0,00" onChange={(e) => (setValor(e.target.value), setOk(false))} required />
          </label>
          <label className="pn-field">
            <span>Dia</span>
            <input type="date" value={dia} max={hoje} onChange={(e) => setDia(e.target.value)} required />
          </label>
        </div>
        <label className="pn-field">
          <span>Tipo</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {erro && <p className="pn-error">{erro}</p>}
        <div className="pn-save">
          <button className="btn btn-primary">Anotar despesa</button>
          {ok && <span className="pn-ok">Anotada.</span>}
        </div>
      </form>

      <div className="pn-daybar pn-mt">
        <button className="pn-icon" aria-label="Mês anterior" onClick={() => setMes(mesAnterior(mes))}>
          <ChevronLeftIcon />
        </button>
        <h3>
          {nomeDoMes(mes, true)} de {mes.slice(0, 4)}
        </h3>
        <button
          className="pn-icon"
          aria-label="Próximo mês"
          disabled={mes >= mesDe(hoje)}
          onClick={() => setMes(mesAnterior(mes, -1))}
        >
          <ChevronRightIcon />
        </button>
      </div>
      <p className="pn-muted pn-centro">
        Total do mês: <strong>{reais(total)}</strong>
        {porCategoria.length > 1 && ` · ${porCategoria.map((c) => `${nomeCategoria(c.key)} ${reais(c.valor)}`).join(' · ')}`}
      </p>
      {erroLista && <p className="pn-error">{erroLista}</p>}
      {lista?.length === 0 && !erroLista && <p className="pn-empty">Nenhuma despesa neste mês.</p>}
      <ul className="pn-list">
        {lista?.map((d) => (
          <li key={d.id} className="pn-card pn-card-flat">
            <div className="pn-card-body">
              <span className="pn-card-service">{d.description}</span>
              <span className="pn-card-client">
                {d.spent_on.slice(8, 10)}/{d.spent_on.slice(5, 7)} · {nomeCategoria(d.category)} · {reais(d.amount_cents)}
              </span>
            </div>
            <button className="pn-btn pn-btn-quiet" onClick={() => apagar(d)}>
              Apagar
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
