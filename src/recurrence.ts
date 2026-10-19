import type { Entry, Goal, RecurringFinePayment } from './types'

export type RecurringPeriod = { start: string; end: string; expected: number; achieved: number; closed: boolean; missed: number }
export type RecurringFine = { periodStart: string; occurrenceIndex: number; label: string; paid: boolean }

const date = (value: string) => new Date(`${value}T12:00:00`)
const iso = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
const addDays = (value: string, days: number) => { const next = date(value); next.setDate(next.getDate() + days); return iso(next) }
const daysBetween = (first: string, last: string) => Math.round((date(last).getTime() - date(first).getTime()) / 86400000) + 1
const firstOfPeriod = (value: string, type: Goal['recurrence_type']) => {
  const current = date(value)
  if (type === 'weekly') current.setDate(current.getDate() - (current.getDay() + 6) % 7)
  if (type === 'monthly') current.setDate(1)
  if (type === 'yearly') { current.setMonth(0); current.setDate(1) }
  return iso(current)
}
const nextPeriod = (value: string, type: Goal['recurrence_type']) => {
  const next = date(value)
  if (type === 'daily') next.setDate(next.getDate() + 1)
  if (type === 'weekly') next.setDate(next.getDate() + 7)
  if (type === 'monthly') next.setMonth(next.getMonth() + 1)
  if (type === 'yearly') next.setFullYear(next.getFullYear() + 1)
  return iso(next)
}

export function recurrenceLabel(goal: Goal) {
  if (goal.recurrence_type === 'daily') return 'Todos os dias'
  if (goal.recurrence_type === 'weekly') return `${goal.weekly_target} ${goal.weekly_target === 1 ? 'dia' : 'dias'} por semana`
  if (goal.recurrence_type === 'monthly') return 'Todo mês'
  if (goal.recurrence_type === 'yearly') return 'Todo ano'
  return 'Uma vez'
}

export function recurringPeriods(goal: Goal, entries: Entry[], asOf: string): RecurringPeriod[] {
  if (goal.recurrence_type === 'none' || !goal.start_date || goal.start_date > goal.deadline) return []
  const periods: RecurringPeriod[] = []
  const relevant = entries.filter(entry => entry.goal_id === goal.id && entry.entry_date >= goal.start_date! && entry.entry_date <= goal.deadline)
  for (let cursor = firstOfPeriod(goal.start_date, goal.recurrence_type); cursor <= goal.deadline; cursor = nextPeriod(cursor, goal.recurrence_type)) {
    const start = cursor > goal.start_date ? cursor : goal.start_date
    const naturalEnd = addDays(nextPeriod(cursor, goal.recurrence_type), -1)
    const end = naturalEnd < goal.deadline ? naturalEnd : goal.deadline
    const logs = relevant.filter(entry => entry.entry_date >= start && entry.entry_date <= end)
    const expected = goal.recurrence_type === 'weekly' ? Math.min(goal.weekly_target ?? 1, daysBetween(start, end)) : 1
    let achieved: number
    if (goal.recurrence_type === 'weekly') {
      const totals = new Map<string, number>()
      for (const entry of logs) totals.set(entry.entry_date, (totals.get(entry.entry_date) ?? 0) + Number(entry.amount))
      achieved = Math.min(expected, [...totals.values()].filter(total => total >= Number(goal.target_value)).length)
    } else {
      achieved = Math.min(expected, Math.floor(logs.reduce((sum, entry) => sum + Number(entry.amount), 0) / Number(goal.target_value)))
    }
    const closed = end < asOf
    periods.push({ start, end, expected, achieved, closed, missed: closed ? expected - achieved : 0 })
  }
  return periods
}

export function recurringProgress(goal: Goal, entries: Entry[], asOf: string) {
  const periods = recurringPeriods(goal, entries, asOf)
  const expected = periods.reduce((sum, period) => sum + period.expected, 0)
  const achieved = periods.reduce((sum, period) => sum + period.achieved, 0)
  return { periods, expected, achieved, percent: expected ? Math.floor(achieved / expected * 100) : 0 }
}

export function recurringFines(goal: Goal, entries: Entry[], payments: RecurringFinePayment[], asOf: string): RecurringFine[] {
  return recurringPeriods(goal, entries, asOf).flatMap(period => {
    const paidIndices = payments.filter(payment => payment.goal_id === goal.id && payment.period_start === period.start).map(payment => payment.occurrence_index).sort((a, b) => a - b)
    const visiblePaid = paidIndices.slice(0, period.missed)
    const slots = visiblePaid.map(index => ({ index, paid: true }))
    for (let index = 1; slots.length < period.missed; index++) if (!paidIndices.includes(index)) slots.push({ index, paid: false })
    return slots.map(({ index, paid }, position) => {
      const label = goal.recurrence_type === 'daily' ? `Dia ${date(period.start).toLocaleDateString('pt-BR')}` : goal.recurrence_type === 'weekly' ? `Semana de ${date(period.start).toLocaleDateString('pt-BR')} · falta ${position + 1} de ${period.missed}` : goal.recurrence_type === 'monthly' ? `Mês de ${date(period.start).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}` : `Ano de ${date(period.start).getFullYear()}`
      return { periodStart: period.start, occurrenceIndex: index, label, paid }
    })
  })
}
