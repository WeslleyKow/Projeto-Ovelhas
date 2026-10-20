import { ArrowRight, Award, Crown, Sparkles, Trophy } from 'lucide-react'
import { useState } from 'react'
import { achievementStats, goalIsConcluded, POINTS_LOST_PER_FAILED_GOAL, POINTS_PER_GOAL, ranks } from './achievements'
import { formatDate, initials, type AppData, type Goal } from './types'
import './achievements.css'

function completedAt(goal: Goal, data: AppData) {
  if (goal.recurrence_type !== 'none') return goal.deadline
  let total = 0
  const entries = data.entries.filter(entry => entry.goal_id === goal.id && entry.entry_date <= goal.deadline).sort((a, b) => a.entry_date.localeCompare(b.entry_date))
  for (const entry of entries) {
    total += Number(entry.amount)
    if (total >= Number(goal.target_value)) return entry.entry_date
  }
  return goal.deadline
}

export function Achievements({ data, onSelectGoal, onSelectRank }: { data: AppData; onSelectGoal: (id: string) => void; onSelectRank: (name: string) => Promise<void> }) {
  const [savingRank, setSavingRank] = useState(false)
  const [rankError, setRankError] = useState('')
  const my = achievementStats(data, data.me)
  const board = data.members.map(member => ({ member, stats: achievementStats(data, member.id) })).sort((a, b) => b.stats.points - a.stats.points || (a.member.id === data.me ? -1 : b.member.id === data.me ? 1 : a.member.name.localeCompare(b.member.name)))
  const recent = data.goals.filter(goal => goalIsConcluded(goal, data.entries)).map(goal => ({ goal, date: completedAt(goal, data) })).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)
  const nextProgress = my.next ? Math.min(100, Math.round((my.points - my.rank.points) / (my.next.points - my.rank.points) * 100)) : 100
  async function chooseRank(name: string) {
    setSavingRank(true)
    setRankError('')
    try { await onSelectRank(name) }
    catch (err) { setRankError(err instanceof Error ? err.message : 'Não foi possível salvar a patente.') }
    finally { setSavingRank(false) }
  }

  return <div className="achievement-page">
    <div className="page-title-row"><div><span className="section-kicker">CADA VITÓRIA CONTA</span><h1>Mural de conquistas</h1><p>Conclua objetivos, some pontos e avance de patente junto com a família.</p></div><span className="achievement-title-icon"><Trophy size={31}/></span></div>
    <div className="achievement-hero">
      <div className="achievement-hero-symbol" aria-hidden="true">{my.displayedRank.symbol}</div>
      <div className="achievement-hero-main"><span className="achievement-eyebrow">SUA PATENTE EM USO</span><h2>{my.displayedRank.name}</h2><p>{my.goals.length} {my.goals.length === 1 ? 'objetivo concluído' : 'objetivos concluídos'} · {my.failedGoals.length} {my.failedGoals.length === 1 ? 'objetivo não cumprido' : 'objetivos não cumpridos'} · {my.points} pontos</p><div className="achievement-meter"><span style={{ width: `${nextProgress}%` }}/></div><small>{my.next ? `Faltam ${my.next.points - my.points} pontos para ${my.next.name}` : 'Você chegou à patente mais alta!'}</small></div>
      <div className="achievement-hero-award"><Crown size={46}/><strong>+{POINTS_PER_GOAL}</strong><span>pontos por objetivo</span></div>
    </div>
    <p className="achievement-rule">Cada objetivo concluído rende +{POINTS_PER_GOAL} pontos. Cada objetivo encerrado sem cumprir a meta tira {POINTS_LOST_PER_FAILED_GOAL} pontos, uma vez por objetivo. A pontuação mínima é zero. Objetivos recorrentes são avaliados ao fim do prazo.</p>
    <div className="achievement-rank-picker"><label htmlFor="selected-rank">Patente que você quer usar</label><select id="selected-rank" value={my.displayedRank.name} disabled={savingRank} onChange={event => void chooseRank(event.target.value)}>{ranks.filter(rank => rank.points <= my.points).map(rank => <option key={rank.name} value={rank.name}>{rank.symbol} {rank.name} · {rank.points} pts</option>)}</select><small>Você pode usar qualquer patente liberada pela sua pontuação atual.</small>{rankError && <p role="alert" className="form-message">{rankError}</p>}</div>

    <div className="achievement-columns"><section><div className="section-heading"><div><span className="section-kicker">QUEM JÁ CHEGOU MAIS LONGE</span><h2>Patentes da família</h2></div></div><div className="achievement-board">{board.map(({ member, stats }, index) => <div className={`achievement-member ${member.id === data.me ? 'is-me' : ''}`} key={member.id}>
      <span className="achievement-position">{index + 1}º</span><span className="avatar" style={{ background: member.color }}>{initials(member.name)}</span><div className="achievement-member-name"><strong>{member.name}{member.id === data.me ? ' (você)' : ''}</strong><small>{stats.goals.length} concluídos · {stats.failedGoals.length} não cumpridos</small><div className="achievement-member-badges">{stats.badges.filter(badge => badge.earned).map(badge => <span title={`${badge.name}: ${badge.description}`} aria-label={badge.name} key={badge.name}>{badge.symbol}</span>)}</div></div><div className="achievement-member-rank"><span>{stats.displayedRank.symbol} {stats.displayedRank.name}</span><strong>{stats.points} pts</strong></div>
    </div>)}</div></section>
    <section><div className="section-heading"><div><span className="section-kicker">PRÓXIMAS MISSÕES</span><h2>Trilha de patentes</h2></div></div><div className="achievement-ranks">{ranks.map(rank => <div className={`achievement-rank ${my.points >= rank.points ? 'unlocked' : ''} ${my.displayedRank.name === rank.name ? 'current' : ''}`} key={rank.name}><span className="achievement-rank-symbol">{rank.symbol}</span><strong>{rank.name}</strong><small>{rank.points} pts</small>{my.displayedRank.name === rank.name && <span className="achievement-current">Em uso</span>}</div>)}</div></section></div>

    <div className="achievement-columns achievement-bottom"><section><div className="section-heading"><div><span className="section-kicker">PEQUENAS GRANDES VITÓRIAS</span><h2>Seus distintivos</h2></div></div><div className="achievement-badges">{my.badges.map(badge => <div className={`achievement-badge ${badge.earned ? 'earned' : ''}`} key={badge.name}><span aria-hidden="true">{badge.symbol}</span><div><strong>{badge.name}</strong><small>{badge.description}</small></div><span className="achievement-badge-status">{badge.earned ? 'Conquistado' : 'A conquistar'}</span></div>)}</div></section>
    <section><div className="section-heading"><div><span className="section-kicker">AS VITÓRIAS MAIS RECENTES</span><h2>Conquistas da família</h2></div></div>{recent.length ? <div className="achievement-recent">{recent.map(({ goal, date }) => { const owner = data.members.find(member => member.id === goal.owner_id); return <button onClick={() => onSelectGoal(goal.id)} key={goal.id}><span className="achievement-recent-icon"><Award size={20}/></span><span><strong>{goal.title}</strong><small>{owner?.name ?? 'Participante'} · {formatDate(date)} · +{POINTS_PER_GOAL} pts</small></span><ArrowRight size={17}/></button> })}</div> : <div className="achievement-empty"><Sparkles size={26}/><strong>A primeira conquista vem aí</strong><p>Quando alguém concluir um objetivo, ele aparecerá neste mural.</p></div>}</section></div>
  </div>
}
