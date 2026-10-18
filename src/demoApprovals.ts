import { type AppData, type Goal, type GoalChangeRequest, type GoalProposal, approvalCount, today } from './types'

function applyChange(data: AppData, request: GoalChangeRequest): AppData {
  if (request.action === 'delete') return { ...data, goals: data.goals.filter(goal => goal.id !== request.goal_id), entries: data.entries.filter(entry => entry.goal_id !== request.goal_id) }
  return { ...data, goals: data.goals.map(goal => goal.id === request.goal_id ? { ...goal, ...request.proposed } : goal) }
}

export function requestDemoChange(data: AppData, goal: Goal, action: 'edit' | 'delete', proposed: GoalProposal | null): AppData {
  if (goal.owner_id !== data.me) throw new Error('Somente o criador pode solicitar esta mudança.')
  if (data.requests.some(request => request.goal_id === goal.id && request.status === 'pending')) throw new Error('Já existe um pedido pendente para este objetivo.')
  if (action === 'edit' && goal.deadline < today()) throw new Error('O prazo do objetivo já terminou.')
  const eligible = data.members.filter(member => member.id !== goal.owner_id).map(member => member.id)
  const required = approvalCount(data.group, eligible.length)
  if (required > eligible.length) throw new Error('A regra exige mais aprovações do que participantes disponíveis.')
  const request: GoalChangeRequest = { id: crypto.randomUUID(), goal_id: goal.id, group_id: goal.group_id, owner_id: goal.owner_id, goal_title: goal.title, action, proposed, eligible_user_ids: eligible, required_approvals: required, status: required ? 'pending' : 'approved', created_at: new Date().toISOString(), resolved_at: required ? null : new Date().toISOString() }
  const next = { ...data, requests: [request, ...data.requests] }
  return required ? next : applyChange(next, request)
}

export function voteDemoChange(data: AppData, request: GoalChangeRequest, approved: boolean): AppData {
  if (request.status !== 'pending' || !request.eligible_user_ids.includes(data.me)) throw new Error('Você não pode votar neste pedido.')
  if (data.votes.some(vote => vote.request_id === request.id && vote.user_id === data.me)) throw new Error('Você já votou neste pedido.')
  const votes = [{ request_id: request.id, user_id: data.me, approved, created_at: new Date().toISOString() }, ...data.votes]
  const current = votes.filter(vote => vote.request_id === request.id)
  const approvals = current.filter(vote => vote.approved).length
  const status = approvals >= request.required_approvals ? 'approved' : approvals + request.eligible_user_ids.length - current.length < request.required_approvals ? 'rejected' : 'pending'
  const updated: GoalChangeRequest = { ...request, status, resolved_at: status === 'pending' ? null : new Date().toISOString() }
  const next = { ...data, votes, requests: data.requests.map(item => item.id === request.id ? updated : item) }
  return status === 'approved' ? applyChange(next, updated) : next
}

export function cancelDemoChange(data: AppData, request: GoalChangeRequest): AppData {
  if (request.owner_id !== data.me || request.status !== 'pending') throw new Error('Este pedido não pode ser cancelado.')
  return { ...data, requests: data.requests.map(item => item.id === request.id ? { ...item, status: 'cancelled', resolved_at: new Date().toISOString() } : item) }
}
