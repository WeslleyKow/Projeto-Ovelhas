import type { AppData, Entry, Goal } from './types'

export type CheckoutRecord = { entry: Entry; goal: Goal; dayTotal: number }

export function checkoutRecords(data: AppData): CheckoutRecord[] {
  const goals = new Map(data.goals.map(goal => [goal.id, goal]))
  const totals = new Map<string, number>()
  for (const entry of data.entries) {
    const key = `${entry.goal_id}:${entry.entry_date}`
    totals.set(key, (totals.get(key) ?? 0) + Number(entry.amount))
  }
  return data.entries.flatMap(entry => {
    const goal = goals.get(entry.goal_id)
    return goal ? [{ entry, goal, dayTotal: totals.get(`${entry.goal_id}:${entry.entry_date}`) ?? 0 }] : []
  }).sort((a, b) => b.entry.created_at.localeCompare(a.entry.created_at) || b.entry.entry_date.localeCompare(a.entry.entry_date))
}
