import { progress, today, type AppData, type Goal } from './types'
import { recurringProgress } from './recurrence'

export const POINTS_PER_GOAL = 100

export const ranks = [
  { name: 'Betinha', points: 0, symbol: '🌱' },
  { name: 'Recruta', points: 100, symbol: '🎯' },
  { name: 'Cabo', points: 200, symbol: '🏅' },
  { name: 'Sargento', points: 400, symbol: '🥉' },
  { name: 'Capitão', points: 700, symbol: '🥈' },
  { name: 'General', points: 1100, symbol: '🥇' },
  { name: 'Lenda', points: 1600, symbol: '👑' }
] as const

export function goalIsConcluded(goal: Goal, entries: AppData['entries'], asOf = today()) {
  if (goal.recurrence_type === 'none') return progress(goal, entries) >= 100
  return goal.deadline < asOf && recurringProgress(goal, entries, asOf).percent >= 100
}

export function rankForPoints(points: number) {
  return [...ranks].reverse().find(rank => points >= rank.points) ?? ranks[0]
}

export function nextRank(points: number) {
  return ranks.find(rank => rank.points > points) ?? null
}

export function completedGoals(data: AppData, ownerId: string) {
  return data.goals.filter(goal => goal.owner_id === ownerId && goalIsConcluded(goal, data.entries))
}

export function achievementStats(data: AppData, ownerId: string) {
  const goals = completedGoals(data, ownerId)
  const points = goals.length * POINTS_PER_GOAL
  const categories = new Set(goals.map(goal => goal.category))
  return {
    goals,
    points,
    rank: rankForPoints(points),
    next: nextRank(points),
    badges: [
      { name: 'Primeira vitória', symbol: '✨', description: 'Concluiu o primeiro objetivo', earned: goals.length >= 1 },
      { name: 'Em movimento', symbol: '🔥', description: 'Concluiu 3 objetivos', earned: goals.length >= 3 },
      { name: 'Veterano', symbol: '🏆', description: 'Concluiu 5 objetivos', earned: goals.length >= 5 },
      { name: 'Multitalento', symbol: '🌈', description: 'Concluiu objetivos de 3 categorias', earned: categories.size >= 3 },
      { name: 'Corpo ativo', symbol: '💪', description: 'Concluiu um objetivo de Saúde', earned: goals.some(goal => goal.category === 'Saúde') },
      { name: 'Mente curiosa', symbol: '📚', description: 'Concluiu um objetivo de Aprendizado ou Leitura', earned: goals.some(goal => goal.category === 'Aprendizado' || goal.category === 'Leitura') },
      { name: 'Maratonista', symbol: '⏳', description: 'Concluiu um objetivo recorrente', earned: goals.some(goal => goal.recurrence_type !== 'none') }
    ]
  }
}
