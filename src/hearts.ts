import { isScheduledDay } from './recurrence'
import { type AppData, type Goal, type HeartReset, type HeartSpend } from './types'

export const HEART_CAPACITY = 3
export function brazilDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}
export function daysAgo(days: number, from = brazilDate()) {
  const [year, month, day] = from.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10)
}
export const yesterdayInBrazil = () => daysAgo(1)

function monthStartInstant(now: Date) {
  const date = brazilDate(now)
  return new Date(`${date.slice(0, 7)}-01T03:00:00Z`).getTime()
}

export function heartStatus(spends: HeartSpend[], resets: HeartReset[] = [], userId?: string, now = new Date()) {
  const resetAt = Math.max(0, ...resets.filter(reset => !userId || reset.user_id === userId).map(reset => new Date(reset.created_at).getTime()))
  const monthStart = monthStartInstant(now)
  const active = spends.filter(spend => (!userId || spend.user_id === userId) && new Date(spend.spent_at).getTime() >= monthStart && new Date(spend.spent_at).getTime() > resetAt)
    .sort((a, b) => a.spent_at.localeCompare(b.spent_at))
  return { available: Math.max(0, HEART_CAPACITY - active.length), active }
}

export function recoverableDay(data: AppData, targetDay: string) {
  return data.goals.filter(goal => goal.owner_id === data.me && ['daily', 'weekly'].includes(goal.recurrence_type) &&
    !!goal.start_date && goal.start_date <= targetDay && goal.deadline >= targetDay && isScheduledDay(goal, targetDay))
    .map(goal => ({ goal, logged: data.entries.filter(entry => entry.goal_id === goal.id && entry.entry_date === targetDay)
      .reduce((sum, entry) => sum + Number(entry.amount), 0) }))
    .filter(item => item.logged < Number(item.goal.target_value))
    .filter(item => !data.finePayments.some(payment => payment.goal_id === item.goal.id &&
      payment.period_start === (item.goal.recurrence_type === 'daily' ? targetDay : weeklyPeriodStart(item.goal, targetDay))))
}

function weeklyPeriodStart(goal: Goal, targetDay: string) {
  const day = new Date(`${targetDay}T12:00:00Z`)
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7)
  const monday = day.toISOString().slice(0, 10)
  return goal.start_date && goal.start_date > monday ? goal.start_date : monday
}

export function recoverDemoDay(data: AppData, targetDay: string, goalIds: string[], now = new Date()): AppData {
  const yesterday = daysAgo(1, brazilDate(now))
  if (targetDay >= brazilDate(now)) throw new Error('Escolha um dia anterior a hoje.')
  if (!goalIds.length || new Set(goalIds).size !== goalIds.length) throw new Error('Selecione os objetivos esquecidos.')
  const eligible = recoverableDay(data, targetDay)
  if (goalIds.some(id => !eligible.some(item => item.goal.id === id))) throw new Error('Um dos objetivos não pode ser recuperado.')
  const usesHeart = targetDay < yesterday && !data.heartSpends.some(spend => spend.user_id === data.me && spend.target_date === targetDay)
  if (usesHeart && heartStatus(data.heartSpends, data.heartResets, data.me, now).available === 0) throw new Error('Você está sem vidas disponíveis.')
  const spends = usesHeart ? [...data.heartSpends, { id: crypto.randomUUID(), user_id: data.me,
    group_id: data.group.id, target_date: targetDay, spent_at: now.toISOString(),
    restores_at: new Date(now.getTime() + 30 * 86400000).toISOString() }] : data.heartSpends
  const entries = goalIds.map(id => {
    const { goal, logged } = eligible.find(item => item.goal.id === id)!
    return { id: crypto.randomUUID(), goal_id: id, author_id: data.me, entry_date: targetDay,
      amount: Math.round((Number(goal.target_value) - logged) * 100) / 100,
      note: 'Meta de dia anterior registrada retroativamente.', photo_path: null, created_at: now.toISOString() }
  })
  return { ...data, heartSpends: spends, entries: [...entries, ...data.entries] }
}

export function resetDemoHearts(data: AppData, now = new Date()): AppData {
  const amount = Number(data.group.heart_reset_fine)
  if (!amount || amount <= 0) throw new Error('O criador da família precisa definir a multa de reset.')
  return { ...data, heartResets: [{ id: crypto.randomUUID(), user_id: data.me, group_id: data.group.id,
    amount, created_at: now.toISOString(), paid_at: null }, ...data.heartResets] }
}
