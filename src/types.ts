import { recurringFines, recurringPeriods, recurringProgress } from './recurrence'

export type Member = { id: string; name: string; color: string; selected_rank?: string | null }
export type ApprovalMode = 'count' | 'percent'
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
export type Group = { id: string; name: string; invite_code: string; created_by: string; approval_mode: ApprovalMode; approval_value: number; pix_qr_path: string | null }
export type GoalProposal = { title: string; description: string; category: string; target_value: number; weekly_target: number | null; weekday_mask?: number | null; unit: string; deadline: string; fine_amount: number; recurrence_type: RecurrenceType; start_date: string | null }
export type Goal = GoalProposal & { id: string; group_id: string; owner_id: string; fine_paid_at?: string | null; deleted_at: string | null; created_at: string }
export type Entry = { id: string; goal_id: string; author_id: string; entry_date: string; amount: number; note: string; photo_path: string | null; created_at: string }
export type RecurringFinePayment = { goal_id: string; period_start: string; occurrence_index: number; paid_at: string }
export type GoalChangeRequest = { id: string; goal_id: string; group_id: string; owner_id: string; goal_title: string; action: 'edit' | 'delete'; proposed: GoalProposal | null; eligible_user_ids: string[]; required_approvals: number; status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired'; created_at: string; resolved_at: string | null }
export type GoalChangeVote = { request_id: string; user_id: string; approved: boolean; created_at: string }
export type AppData = { group: Group; members: Member[]; goals: Goal[]; entries: Entry[]; finePayments: RecurringFinePayment[]; requests: GoalChangeRequest[]; votes: GoalChangeVote[]; me: string }
export const colors = ['#b2c69d','#c4b9e8','#f2c5a8','#9dc7c4','#e2c5d1','#d8ce9c']
export const today = () => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = (name: string) => parts.find(item => item.type === name)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}
export const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
export const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const initials = (name: string) => name.split(' ').filter(Boolean).slice(0,2).map(part => part[0].toUpperCase()).join('')
export const completed = (goal: Goal, entries: Entry[]) => entries.filter(entry => entry.goal_id === goal.id && entry.entry_date <= goal.deadline).reduce((sum, entry) => sum + Number(entry.amount), 0)
export const progress = (goal: Goal, entries: Entry[]) => goal.recurrence_type && goal.recurrence_type !== 'none' ? recurringProgress(goal, entries, today()).percent : Math.min(100, Math.floor(completed(goal, entries) / Number(goal.target_value) * 100))
export const fineIsDue = (goal: Goal, entries: Entry[]) => goal.recurrence_type && goal.recurrence_type !== 'none' ? recurringPeriods(goal, entries, today()).some(period => period.missed > 0) : goal.deadline < today() && progress(goal, entries) < 100
export const unpaidFine = (goal: Goal, entries: Entry[], payments: RecurringFinePayment[] = []) => goal.recurrence_type && goal.recurrence_type !== 'none' ? recurringFines(goal, entries, payments, today()).some(fine => !fine.paid) : fineIsDue(goal, entries) && !goal.fine_paid_at
export const approvalCount = (group: Group, otherMembers: number) => otherMembers === 0 ? 0 : group.approval_mode === 'percent' ? Math.ceil(otherMembers * group.approval_value / 100) : group.approval_value
export const daysSince = (date: string) => Math.max(0, Math.floor((new Date(`${today()}T12:00:00`).getTime() - new Date(`${date}T12:00:00`).getTime()) / 86400000))
export const weekCount = (goal: Goal, entries: Entry[]) => { const now = new Date(`${today()}T12:00:00`); const weekday = (now.getDay() + 6) % 7; now.setDate(now.getDate() - weekday); const start = now.toLocaleDateString('en-CA'); return new Set(entries.filter(entry => entry.goal_id === goal.id && entry.entry_date >= start && entry.entry_date <= goal.deadline).map(entry => entry.entry_date)).size }

export const weekDates = () => { const monday = new Date(`${today()}T12:00:00`); monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7); return Array.from({ length: 7 }, (_, i) => { const date = new Date(monday); date.setDate(monday.getDate() + i); return date.toLocaleDateString('en-CA') }) }
