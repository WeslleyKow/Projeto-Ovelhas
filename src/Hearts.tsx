import { useState } from 'react'
import { ArrowRight, Heart, RefreshCw } from 'lucide-react'
import { heartStatus, recoverableYesterday, yesterdayInBrazil } from './hearts'
import { type AppData, formatDate } from './types'

function returnDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export function Hearts({ data, onRecover, onRefresh }: { data: AppData; onRecover: (day: string, ids: string[]) => Promise<void>; onRefresh: () => Promise<void> }) {
  const targetDay = yesterdayInBrazil()
  const status = heartStatus(data.heartSpends)
  const usedForYesterday = data.heartSpends.some(spend => spend.user_id === data.me && spend.target_date === targetDay)
  const eligible = recoverableYesterday(data, targetDay)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const selectedValid = selected.filter(id => eligible.some(item => item.goal.id === id))
  async function submit() {
    if (!selectedValid.length || busy) return
    setBusy(true); setError('')
    try { await onRecover(targetDay, selectedValid); setSelected([]) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível recuperar os objetivos.') }
    finally { setBusy(false) }
  }
  async function refresh() {
    if (refreshing) return
    setRefreshing(true); setError('')
    try { await onRefresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar as vidas.') }
    finally { setRefreshing(false) }
  }
  return <div className="hearts-page">
    <div className="page-title-row"><div><span className="section-kicker">UMA SEGUNDA CHANCE</span><h1>Suas vidas</h1><p>Use um coração quando tiver cumprido uma meta e esquecido de marcá-la no próprio dia.</p></div><button className="outline" onClick={refresh} disabled={refreshing}><RefreshCw size={16}/>{refreshing ? 'Atualizando...' : 'Atualizar vidas'}</button></div>
    <div className="heart-balance"><div><span className="section-kicker">CORAÇÕES DISPONÍVEIS</span><strong>{status.available} de 3</strong><p>Cada coração gasto retorna automaticamente 30 dias depois, contando a partir do momento do uso.</p></div><div className="heart-icons" aria-label={`${status.available} de 3 corações disponíveis`}>{Array.from({ length: 3 }, (_, index) => <Heart key={index} size={38} fill={index < status.available ? 'currentColor' : 'none'} className={index < status.available ? 'available' : 'spent'}/>)}</div></div>
    {status.active.length > 0 && <div className="heart-returns"><h2>Quando voltam</h2>{status.active.map(spend => <div key={spend.id}><Heart size={16}/><span>Coração usado para {formatDate(spend.target_date)}</span><strong>{returnDate(spend.restores_at)}</strong></div>)}</div>}
    <section className="heart-recovery"><div className="section-heading"><div><span className="section-kicker">RECUPERAR UM DIA</span><h2>Ontem, {formatDate(targetDay)}</h2></div></div><p>Escolha os objetivos recorrentes que você realmente cumpriu ontem. O registro ficará na data de ontem e mostrará o horário real em que você usou o coração.</p>
      {usedForYesterday && <p className="heart-info">Você já gastou um coração por ontem. Pode incluir outros objetivos desse dia sem gastar mais um.</p>}
      {eligible.length > 0 ? <><div className="heart-goal-list">{eligible.map(({ goal, logged }) => <label key={goal.id} className="heart-goal"><input type="checkbox" checked={selectedValid.includes(goal.id)} onChange={event => setSelected(current => event.target.checked ? [...current, goal.id] : current.filter(id => id !== goal.id))}/><span><strong>{goal.title}</strong><small>{logged > 0 ? `${logged} de ${goal.target_value} ${goal.unit} já registrados; falta completar` : `Meta: ${goal.target_value} ${goal.unit}`}</small></span></label>)}</div><p className="heart-hint">Um coração cobre todos os objetivos escolhidos para ontem. Se lembrar de outro depois, poderá incluí-lo hoje sem gastar outro coração.</p><button className="primary" disabled={!selectedValid.length || busy || (status.available === 0 && !usedForYesterday)} onClick={submit}><Heart size={17}/>{busy ? 'Recuperando...' : usedForYesterday ? 'Completar recuperação de ontem' : 'Usar 1 coração e recuperar'} <ArrowRight size={16}/></button>{status.available === 0 && !usedForYesterday && <p className="heart-hint">Seus corações estão se regenerando. Veja acima quando o próximo retorna.</p>}</> : <div className="empty"><Heart size={32}/><h3>Nenhum objetivo para recuperar</h3><p>Seus objetivos diários e semanais de ontem já estão completos ou não exigiam registro.</p></div>}
      {error && <p className="form-message" role="alert">{error}</p>}
    </section>
  </div>
}
