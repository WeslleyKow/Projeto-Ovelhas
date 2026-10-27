import { useState } from 'react'
import { ArrowRight, Heart, RefreshCw } from 'lucide-react'
import { heartStatus, recoverableDay, yesterdayInBrazil } from './hearts'
import { type AppData, formatDate, money } from './types'

export function Hearts({ data, onRecover, onRefresh, onReset }: { data: AppData; onRecover: (day: string, ids: string[]) => Promise<void>; onRefresh: () => Promise<void>; onReset: () => Promise<void> }) {
  const yesterday = yesterdayInBrazil()
  const [targetDay, setTargetDay] = useState(yesterday)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const status = heartStatus(data.heartSpends, data.heartResets, data.me)
  const free = targetDay === yesterday
  const usedForDay = data.heartSpends.some(spend => spend.user_id === data.me && spend.target_date === targetDay)
  const earliest = data.goals.filter(goal => goal.owner_id === data.me && !!goal.start_date && ['daily', 'weekly'].includes(goal.recurrence_type))
    .map(goal => goal.start_date!).sort()[0] ?? yesterday
  const eligible = targetDay <= yesterday && targetDay >= earliest ? recoverableDay(data, targetDay) : []
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
  async function reset() {
    const amount = Number(data.group.heart_reset_fine)
    if (!amount || busy || !window.confirm(`Resetar suas vidas para 3? Esta ação gera uma multa de ${money(amount)} em seu nome.`)) return
    setBusy(true); setError('')
    try { await onReset() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível resetar as vidas.') }
    finally { setBusy(false) }
  }
  return <div className="hearts-page">
    <div className="page-title-row"><div><span className="section-kicker">UMA SEGUNDA CHANCE</span><h1>Suas vidas</h1><p>Registre ontem gratuitamente. Para dias anteriores, use uma vida por dia.</p></div><button className="outline" onClick={refresh} disabled={refreshing}><RefreshCw size={16}/>{refreshing ? 'Atualizando...' : 'Atualizar vidas'}</button></div>
    <div className="heart-balance"><div><span className="section-kicker">CORAÇÕES DISPONÍVEIS</span><strong>{status.available} de 3</strong><p>Todos voltam a ter três vidas no dia 1º de cada mês, no horário de Brasília.</p></div><div className="heart-icons" aria-label={`${status.available} de 3 corações disponíveis`}>{Array.from({ length: 3 }, (_, index) => <Heart key={index} size={38} fill={index < status.available ? 'currentColor' : 'none'} className={index < status.available ? 'available' : 'spent'}/>)}</div></div>
    <div className="heart-returns"><h2>Resetar vidas</h2><p>O reset devolve seus três corações agora e gera uma multa em seu nome. O valor é definido pelo criador da família.</p><button className="outline" disabled={busy || !data.group.heart_reset_fine} onClick={reset}><RefreshCw size={16}/> Resetar vidas{data.group.heart_reset_fine ? ` · ${money(Number(data.group.heart_reset_fine))}` : ''}</button>{!data.group.heart_reset_fine && <p className="heart-hint">A família ainda precisa configurar o valor desta multa.</p>}</div>
    <section className="heart-recovery"><div className="section-heading"><div><span className="section-kicker">RECUPERAR UM DIA</span><h2>Escolha o dia</h2></div></div><label className="heart-day-picker">Data da ocorrência<input type="date" min={earliest} max={yesterday} value={targetDay} onChange={event => { setTargetDay(event.target.value); setSelected([]); setError('') }}/></label><p>{free ? `Ontem, ${formatDate(targetDay)}: registro gratuito.` : `${formatDate(targetDay)}: uma vida para todos os objetivos escolhidos desse dia.`} O registro mostrará a data da ocorrência e o horário real em que foi marcado.</p>
      {!free && usedForDay && <p className="heart-info">Você já usou uma vida para este dia. Pode incluir outros objetivos sem gastar outra.</p>}
      {eligible.length > 0 ? <><div className="heart-goal-list">{eligible.map(({ goal, logged }) => <label key={goal.id} className="heart-goal"><input type="checkbox" checked={selectedValid.includes(goal.id)} onChange={event => setSelected(current => event.target.checked ? [...current, goal.id] : current.filter(id => id !== goal.id))}/><span><strong>{goal.title}</strong><small>{logged > 0 ? `${logged} de ${goal.target_value} ${goal.unit} já registrados; falta completar` : `Meta: ${goal.target_value} ${goal.unit}`}</small></span></label>)}</div><p className="heart-hint">{free ? 'Você pode registrar outros objetivos de ontem até o fim de hoje, sem gastar vidas.' : 'Uma vida cobre todos os objetivos deste dia, mesmo que você os marque em momentos diferentes.'}</p><button className="primary" disabled={!selectedValid.length || busy || (!free && status.available === 0 && !usedForDay)} onClick={submit}><Heart size={17}/>{busy ? 'Registrando...' : free ? 'Registrar ontem sem gastar vida' : usedForDay ? 'Completar registros deste dia' : 'Usar 1 vida e registrar'} <ArrowRight size={16}/></button>{!free && status.available === 0 && !usedForDay && <p className="heart-hint">Você está sem vidas. Elas voltam no dia 1º ou podem ser resetadas mediante multa.</p>}</> : <div className="empty"><Heart size={32}/><h3>Nenhum objetivo para registrar</h3><p>Os objetivos diários e semanais desse dia já estão completos ou não exigiam registro.</p></div>}
      {error && <p className="form-message" role="alert">{error}</p>}
    </section>
  </div>
}
