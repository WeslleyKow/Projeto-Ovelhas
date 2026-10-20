import { progress, today, type AppData, type Goal } from './types'
import { recurringProgress } from './recurrence'

export const POINTS_PER_GOAL = 100
export const POINTS_LOST_PER_FAILED_GOAL = 100

export const ranks = [
  { name: 'Betinha', points: 0, symbol: '🌱' },
  { name: 'Recruta', points: 100, symbol: '🎯' },
  { name: 'Cabo', points: 200, symbol: '🏅' },
  { name: 'Cabo Veterano', points: 300, symbol: '🎖️' },
  { name: 'Sargento', points: 400, symbol: '🥉' },
  { name: 'Sargento-Mor', points: 500, symbol: '🛡️' },
  { name: 'Subtenente', points: 600, symbol: '⚔️' },
  { name: 'Capitão', points: 700, symbol: '🥈' },
  { name: 'Major', points: 800, symbol: '⭐' },
  { name: 'Comandante', points: 900, symbol: '🌟' },
  { name: 'Coronel', points: 1000, symbol: '🎗️' },
  { name: 'General', points: 1100, symbol: '🥇' },
  { name: 'General de Divisão', points: 1200, symbol: '🏵️' },
  { name: 'Marechal', points: 1300, symbol: '🏆' },
  { name: 'Mito', points: 1400, symbol: '⚡' },
  { name: 'Semideus', points: 1500, symbol: '☀️' },
  { name: 'Lenda', points: 1600, symbol: '👑' },
  { name: 'Lenda Suprema', points: 1800, symbol: '💎' },
  { name: 'Imortal', points: 2000, symbol: '♾️' },
  { name: 'Titã', points: 2500, symbol: '🗿' },
  { name: 'Guardião da Família', points: 3000, symbol: '🦁' },
  { name: 'Monarca', points: 3500, symbol: '🦅' },
  { name: 'Ícone', points: 4000, symbol: '🌠' },
  { name: 'Eterno', points: 5000, symbol: '✨' }
] as const

export function goalIsConcluded(goal: Goal, entries: AppData['entries'], asOf = today()) {
  if (goal.recurrence_type === 'none') return progress(goal, entries) >= 100
  return goal.deadline < asOf && recurringProgress(goal, entries, asOf).percent >= 100
}

export function goalHasFailed(goal: Goal, entries: AppData['entries'], asOf = today()) {
  if (goal.deadline >= asOf) return false
  return !goalIsConcluded(goal, entries, asOf)
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

export function displayedRank(points: number, selectedRank?: string | null) {
  return ranks.find(rank => rank.name === selectedRank && rank.points <= points) ?? rankForPoints(points)
}

export function achievementStats(data: AppData, ownerId: string) {
  const goals = completedGoals(data, ownerId)
  const failedGoals = data.goals.filter(goal => goal.owner_id === ownerId && goalHasFailed(goal, data.entries))
  const points = Math.max(0, goals.length * POINTS_PER_GOAL - failedGoals.length * POINTS_LOST_PER_FAILED_GOAL)
  const categories = new Set(goals.map(goal => goal.category))
  const member = data.members.find(member => member.id === ownerId)
  return {
    goals,
    failedGoals,
    points,
    rank: rankForPoints(points),
    displayedRank: displayedRank(points, member?.selected_rank),
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
