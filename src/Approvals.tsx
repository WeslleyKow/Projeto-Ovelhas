import { Check, RefreshCw, X } from 'lucide-react'
import { type AppData, type Goal, type GoalChangeRequest, type Group, formatDate, money } from './types'
import { recurrenceLabel } from './recurrence'

function addedRestDates(request: GoalChangeRequest, goal?: Goal) {
  if (request.action !== 'edit' || !request.proposed || !goal) return []
  return (request.proposed.rest_dates ?? []).filter(day => !(goal.rest_dates ?? []).includes(day))
}

function isRestDayRequest(request: GoalChangeRequest, goal?: Goal) {
  const next = request.proposed
  if (!next || !goal || goal.recurrence_type !== 'daily' || addedRestDates(request, goal).length !== 1) return false
  const previousDates = goal.rest_dates ?? []
  if (previousDates.some(day => !(next.rest_dates ?? []).includes(day))) return false
  return next.title === goal.title && next.description === goal.description && next.category === goal.category &&
    Number(next.target_value) === Number(goal.target_value) && next.weekly_target === goal.weekly_target &&
    (next.weekday_mask ?? null) === (goal.weekday_mask ?? null) && next.unit === goal.unit &&
    next.deadline === goal.deadline && Number(next.fine_amount) === Number(goal.fine_amount) &&
    next.recurrence_type === goal.recurrence_type && next.start_date === goal.start_date
}

export function ruleText(group: Pick<Group, 'approval_mode' | 'approval_value'>, others: number) {
  if (!others) return 'Sem outros participantes: aplicação imediata'
  if (group.approval_mode === 'percent') return `${group.approval_value}% dos demais participantes`
  return `${group.approval_value} ${group.approval_value === 1 ? 'aprovação' : 'aprovações'} dos demais participantes`
}

function changeSummary(request: GoalChangeRequest, goal?: Goal) {
  if (request.action === 'delete') return ['O objetivo deixará de aparecer nas metas, no ranking e no diário. O histórico ficará guardado para auditoria.']
  if (!request.proposed || !goal) return ['Os dados do objetivo serão atualizados após a aprovação.']
  const next = request.proposed
  const changes: string[] = []
  if (next.title !== goal.title) changes.push(`Nome: ${goal.title} → ${next.title}`)
  if (next.description !== goal.description) changes.push('Descrição alterada')
  if (next.category !== goal.category) changes.push(`Categoria: ${goal.category} → ${next.category}`)
  if (Number(next.target_value) !== Number(goal.target_value) || next.unit !== goal.unit) changes.push(`Meta: ${goal.target_value} ${goal.unit} → ${next.target_value} ${next.unit}`)
  if (next.recurrence_type === 'none' && goal.recurrence_type === 'none' && next.weekly_target !== goal.weekly_target) changes.push(`Frequência: ${goal.weekly_target ?? 'sem meta'} → ${next.weekly_target ?? 'sem meta'} dias/semana`)
  if (next.deadline !== goal.deadline) changes.push(`Prazo: ${formatDate(goal.deadline)} → ${formatDate(next.deadline)}`)
  if (Number(next.fine_amount) !== Number(goal.fine_amount)) changes.push(`Multa: ${money(Number(goal.fine_amount))} → ${money(Number(next.fine_amount))}`)
  if (next.recurrence_type !== goal.recurrence_type || next.start_date !== goal.start_date || (next.recurrence_type !== 'none' && next.weekly_target !== goal.weekly_target)) changes.push(`Recorrência: ${recurrenceLabel(goal)} → ${recurrenceLabel({ ...goal, ...next })}`)
  if ((next.weekday_mask ?? null) !== (goal.weekday_mask ?? null) && next.recurrence_type === goal.recurrence_type) changes.push(`Dias ativos: ${recurrenceLabel(goal)} → ${recurrenceLabel({ ...goal, ...next })}`)
  for (const day of addedRestDates(request, goal)) changes.push(`Folga solicitada: ${formatDate(day)}`)
  for (const day of (goal.rest_dates ?? []).filter(date => !(next.rest_dates ?? []).includes(date))) changes.push(`Folga removida: ${formatDate(day)}`)
  return changes.length ? changes : ['Nenhum campo alterado']
}

export function RequestCard({ request, data, onVote, onCancel }: { request: GoalChangeRequest; data: AppData; onVote: (request: GoalChangeRequest, approved: boolean) => Promise<void>; onCancel: (request: GoalChangeRequest) => Promise<void> }) {
  const goal = data.goals.find(item => item.id === request.goal_id)
  const owner = data.members.find(item => item.id === request.owner_id)
  const votes = data.votes.filter(item => item.request_id === request.id)
  const approvals = votes.filter(item => item.approved).length
  const myVote = votes.find(item => item.user_id === data.me)
  const canVote = request.eligible_user_ids.includes(data.me) && !myVote
  const restDayRequest = isRestDayRequest(request, goal)
  const expired = request.action === 'edit' && !!goal && goal.deadline < new Date().toLocaleDateString('en-CA')
  return <div className="request-card"><div className="request-head"><div><span className="section-kicker">{request.action === 'delete' ? 'PEDIDO DE EXCLUSÃO' : restDayRequest ? 'PEDIDO DE FOLGA' : 'PEDIDO DE EDIÇÃO'}</span><h3>{request.goal_title}</h3><small>Solicitado por {owner?.name || 'Participante'}</small></div><span className="count-pill">{approvals}/{request.required_approvals} aprovações</span></div><ul>{changeSummary(request, goal).map(item => <li key={item}>{item}</li>)}</ul><p className="request-note">{expired ? 'O prazo terminou. A edição não poderá mais ser aprovada.' : `Precisam autorizar ${request.required_approvals} dos ${request.eligible_user_ids.length} outros participantes. O criador não vota.`}</p><div className="request-actions">{canVote && !expired && <><button className="primary" onClick={() => onVote(request, true)}><Check size={15}/> Autorizar</button><button className="outline" onClick={() => onVote(request, false)}><X size={15}/> Recusar</button></>}{myVote && <span className="vote-result">Você {myVote.approved ? 'autorizou' : 'recusou'} este pedido.</span>}{request.owner_id === data.me && <button className="text-button" onClick={() => onCancel(request)}>Cancelar pedido</button>}</div></div>
}

export function RequestsSection({ data, onVote, onCancel, onRefresh }: { data: AppData; onVote: (request: GoalChangeRequest, approved: boolean) => Promise<void>; onCancel: (request: GoalChangeRequest) => Promise<void>; onRefresh: () => Promise<void> }) {
  const pending = data.requests.filter(item => item.status === 'pending')
  return <section className="requests-section"><div className="section-heading"><div><span className="section-kicker">DECISÕES EM FAMÍLIA</span><h2>Pedidos de aprovação</h2></div><button className="link-button" onClick={onRefresh}><RefreshCw size={15}/> Atualizar</button></div>{pending.length ? <div className="request-list">{pending.map(request => <RequestCard key={request.id} request={request} data={data} onVote={onVote} onCancel={onCancel}/>)}</div> : <div className="empty request-empty"><h3>Nenhum pedido pendente</h3><p>Pedidos de folga, edição e exclusão aparecerão aqui para a família votar.</p></div>}</section>
}
