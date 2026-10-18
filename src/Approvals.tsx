import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Check, Copy, RefreshCw, X } from 'lucide-react'
import { type AppData, type Goal, type GoalChangeRequest, formatDate, money } from './types'

export function ruleText(goal: Pick<Goal, 'approval_mode' | 'approval_value'>, others: number) {
  if (!others) return 'Sem outros participantes: aplicação imediata'
  if (goal.approval_mode === 'percent') return `${goal.approval_value}% dos demais participantes`
  return `${goal.approval_value} ${goal.approval_value === 1 ? 'aprovação' : 'aprovações'} dos demais participantes`
}

export function PixPanel({ code }: { code: string }) {
  const [image, setImage] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(code, { width: 220, margin: 2 }).then(result => { if (alive) setImage(result) }).catch(() => { if (alive) setImage('') })
    return () => { alive = false }
  }, [code])
  return <div className="pix-panel"><strong>QR Code Pix da multa</strong>{image && <img src={image} alt="QR Code Pix para pagamento da multa"/>}<p>Confira o destinatário no seu aplicativo bancário antes de pagar.</p><div className="pix-copy"><code>{code}</code><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true) } catch { setCopied(false) } }}><Copy size={14}/>{copied ? 'Copiado' : 'Copiar'}</button></div></div>
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
  if (next.weekly_target !== goal.weekly_target) changes.push(`Frequência: ${goal.weekly_target ?? 'sem meta'} → ${next.weekly_target ?? 'sem meta'} dias/semana`)
  if (next.deadline !== goal.deadline) changes.push(`Prazo: ${formatDate(goal.deadline)} → ${formatDate(next.deadline)}`)
  if (Number(next.fine_amount) !== Number(goal.fine_amount)) changes.push(`Multa: ${money(Number(goal.fine_amount))} → ${money(Number(next.fine_amount))}`)
  if (next.approval_mode !== goal.approval_mode || next.approval_value !== goal.approval_value) changes.push(`Regra: ${next.approval_mode === 'percent' ? `${next.approval_value}%` : `${next.approval_value} aprovação(ões)`}`)
  if ((next.pix_code || null) !== (goal.pix_code || null)) changes.push('Código Pix alterado')
  return changes.length ? changes : ['Nenhum campo alterado']
}

export function RequestCard({ request, data, onVote, onCancel }: { request: GoalChangeRequest; data: AppData; onVote: (request: GoalChangeRequest, approved: boolean) => Promise<void>; onCancel: (request: GoalChangeRequest) => Promise<void> }) {
  const goal = data.goals.find(item => item.id === request.goal_id)
  const owner = data.members.find(item => item.id === request.owner_id)
  const votes = data.votes.filter(item => item.request_id === request.id)
  const approvals = votes.filter(item => item.approved).length
  const myVote = votes.find(item => item.user_id === data.me)
  const canVote = request.eligible_user_ids.includes(data.me) && !myVote
  const expired = request.action === 'edit' && !!goal && goal.deadline < new Date().toLocaleDateString('en-CA')
  return <div className="request-card"><div className="request-head"><div><span className="section-kicker">{request.action === 'delete' ? 'PEDIDO DE EXCLUSÃO' : 'PEDIDO DE EDIÇÃO'}</span><h3>{request.goal_title}</h3><small>Solicitado por {owner?.name || 'Participante'}</small></div><span className="count-pill">{approvals}/{request.required_approvals} aprovações</span></div><ul>{changeSummary(request, goal).map(item => <li key={item}>{item}</li>)}</ul><p className="request-note">{expired ? 'O prazo terminou. A edição não poderá mais ser aprovada.' : `Precisam autorizar ${request.required_approvals} dos ${request.eligible_user_ids.length} outros participantes. O criador não vota.`}</p><div className="request-actions">{canVote && !expired && <><button className="primary" onClick={() => onVote(request, true)}><Check size={15}/> Autorizar</button><button className="outline" onClick={() => onVote(request, false)}><X size={15}/> Recusar</button></>}{myVote && <span className="vote-result">Você {myVote.approved ? 'autorizou' : 'recusou'} este pedido.</span>}{request.owner_id === data.me && <button className="text-button" onClick={() => onCancel(request)}>Cancelar pedido</button>}</div></div>
}

export function RequestsSection({ data, onVote, onCancel, onRefresh }: { data: AppData; onVote: (request: GoalChangeRequest, approved: boolean) => Promise<void>; onCancel: (request: GoalChangeRequest) => Promise<void>; onRefresh: () => Promise<void> }) {
  const pending = data.requests.filter(item => item.status === 'pending')
  return <section className="requests-section"><div className="section-heading"><div><span className="section-kicker">DECISÕES EM FAMÍLIA</span><h2>Pedidos de aprovação</h2></div><button className="link-button" onClick={onRefresh}><RefreshCw size={15}/> Atualizar</button></div>{pending.length ? <div className="request-list">{pending.map(request => <RequestCard key={request.id} request={request} data={data} onVote={onVote} onCancel={onCancel}/>)}</div> : <div className="empty request-empty"><h3>Nenhum pedido pendente</h3><p>Pedidos de edição e exclusão aparecerão aqui para a família votar.</p></div>}</section>
}
