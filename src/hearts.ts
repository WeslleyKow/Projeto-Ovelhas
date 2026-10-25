import { isScheduledDay } from './recurrence'
import { type AppData, type Goal, type HeartSpend, today } from './types'

export const HEART_CAPACITY = 3
const HEART_RESTORE_MS = 30 * 24 * 60 * 60 * 1000

export function yesterdayInBrazil() {
  const [year, month, day] = today().split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10)
}

export function heartStatus(spends: HeartSpend[], now = new Date()) {
  const active = spends.filter(spend => new Date(spend.restores_at).getTime() > now.getTime())
    .sort((a, b) => a.restores_at.localeCompare(b.restores_at))
  return { available: Math.max(0, HEART_CAPACITY - active.length), active }
}

export function recoverableYesterday(data: AppData, targetDay = yesterdayInBrazil()) {
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

export function recoverDemoYesterday(data: AppData, targetDay: string, goalIds: string[], now = new Date()): AppData {
  if (targetDay !== yesterdayInBrazil()) throw new Error('O coração só recupera o dia anterior.')
  if (!goalIds.length || new Set(goalIds).size !== goalIds.length) throw new Error('Selecione os objetivos esquecidos.')
  const eligible = recoverableYesterday(data, targetDay)
  if (goalIds.some(id => !eligible.some(item => item.goal.id === id))) throw new Error('Um dos objetivos não pode ser recuperado.')
  const existing = data.heartSpends.some(spend => spend.user_id === data.me && spend.target_date === targetDay)
  if (!existing && heartStatus(data.heartSpends, now).available === 0) throw new Error('Você está sem corações disponíveis.')
  const spends = existing ? data.heartSpends : [...data.heartSpends, { id: crypto.randomUUID(), user_id: data.me,
    group_id: data.group.id, target_date: targetDay, spent_at: now.toISOString(),
    restores_at: new Date(now.getTime() + HEART_RESTORE_MS).toISOString() }]
  const entries = goalIds.map(id => {
    const { goal, logged } = eligible.find(item => item.goal.id === id)!
    return { id: crypto.randomUUID(), goal_id: id, author_id: data.me, entry_date: targetDay,
      amount: Math.round((Number(goal.target_value) - logged) * 100) / 100,
      note: 'Meta do dia anterior recuperada com coração.', photo_path: null, created_at: now.toISOString() }
  })
  return { ...data, heartSpends: spends, entries: [...entries, ...data.entries] }
}
