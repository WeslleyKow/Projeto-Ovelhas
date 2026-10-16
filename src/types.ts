export type Member = { id: string; name: string; color: string }
export type Group = { id: string; name: string; invite_code: string }
export type Goal = { id: string; group_id: string; owner_id: string; title: string; description: string; category: string; target_value: number; weekly_target: number | null; unit: string; deadline: string; fine_amount: number; created_at: string }
export type Entry = { id: string; goal_id: string; author_id: string; entry_date: string; amount: number; note: string; photo_path: string | null; created_at: string }
export type AppData = { group: Group; members: Member[]; goals: Goal[]; entries: Entry[]; me: string }
export const colors = ['#b2c69d','#c4b9e8','#f2c5a8','#9dc7c4','#e2c5d1','#d8ce9c']
export const today = () => new Date().toLocaleDateString('en-CA')
export const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
export const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const initials = (name: string) => name.split(' ').filter(Boolean).slice(0,2).map(part => part[0].toUpperCase()).join('')
export const progress = (goal: Goal, entries: Entry[]) => Math.min(100, Math.round(entries.filter(entry => entry.goal_id === goal.id).reduce((sum, entry) => sum + Number(entry.amount), 0) / Number(goal.target_value) * 100))
export const completed = (goal: Goal, entries: Entry[]) => entries.filter(entry => entry.goal_id === goal.id).reduce((sum, entry) => sum + Number(entry.amount), 0)
export const daysSince = (date: string) => Math.max(0, Math.floor((new Date(`${today()}T12:00:00`).getTime() - new Date(`${date}T12:00:00`).getTime()) / 86400000))

export const weekCount = (goal: Goal, entries: Entry[]) => { const now = new Date(`${today()}T12:00:00`); const weekday = (now.getDay() + 6) % 7; now.setDate(now.getDate() - weekday); const start = now.toLocaleDateString('en-CA'); return new Set(entries.filter(entry => entry.goal_id === goal.id && entry.entry_date >= start).map(entry => entry.entry_date)).size }
