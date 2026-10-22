import { recurringFines, recurringPeriods } from './recurrence'
import { type AppData, type Goal, completed, formatDate, today } from './types'

export type PendingFine = {
  key: string
  goal: Goal
  amount: number
  periodStart: string
  label: string
  reason: string
}

export function pendingFines(data: AppData, asOf = today()): PendingFine[] {
  const items: PendingFine[] = []
  for (const goal of data.goals) {
    const amount = Number(goal.fine_amount)
    if (amount <= 0) continue
    if (goal.recurrence_type === 'none') {
      const achieved = completed(goal, data.entries)
      if (goal.deadline < asOf && achieved < Number(goal.target_value) && !goal.fine_paid_at) {
        items.push({ key: goal.id, goal, amount, periodStart: goal.deadline,
          label: `Prazo encerrado em ${formatDate(goal.deadline)}`,
          reason: `Meta de ${goal.target_value} ${goal.unit}; ${achieved} ${goal.unit} registrados até o prazo.` })
      }
      continue
    }
    const periods = recurringPeriods(goal, data.entries, asOf)
    for (const fine of recurringFines(goal, data.entries, data.finePayments, asOf)) {
      if (fine.paid) continue
      const period = periods.find(item => item.start === fine.periodStart)
      const reason = goal.recurrence_type === 'weekly' && period
        ? `Na semana de ${formatDate(period.start)} a ${formatDate(period.end)}, ${period.achieved} de ${period.expected} dias exigidos foram cumpridos.`
        : goal.recurrence_type === 'daily'
          ? `Meta de ${goal.target_value} ${goal.unit} não cumprida neste dia.`
          : `Meta de ${goal.target_value} ${goal.unit} não atingida neste período.`
      items.push({ key: `${goal.id}:${fine.periodStart}:${fine.occurrenceIndex}`, goal, amount,
        periodStart: fine.periodStart, label: fine.label, reason })
    }
  }
  return items.sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.goal.title.localeCompare(b.goal.title))
}
