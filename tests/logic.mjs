import assert from 'node:assert/strict'
import { build } from 'esbuild'

async function loadModule(path) {
  const result = await build({ entryPoints: [new URL(path, import.meta.url).pathname], bundle: true, platform: 'node', format: 'esm', write: false })
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
}
const { completed, progress, fineIsDue, unpaidFine, weekCount, approvalCount, today } = await loadModule('../src/types.ts')
const { recurringPeriods, recurringProgress, recurringFines } = await loadModule('../src/recurrence.ts')
const { achievementStats, goalIsConcluded, rankForPoints } = await loadModule('../src/achievements.ts')
const yesterday = new Date(`${today()}T12:00:00`); yesterday.setDate(yesterday.getDate() - 1)
const deadline = yesterday.toLocaleDateString('en-CA')
const goal = { id: 'goal', target_value: 100, deadline, fine_amount: 15, weekly_target: 5, fine_paid_at: null }
const logs = [
  { goal_id: 'goal', entry_date: deadline, amount: 99.5 },
  { goal_id: 'goal', entry_date: today(), amount: 2 }
]
assert.equal(completed(goal, logs), 99.5, 'late logs do not change the final result')
assert.equal(progress(goal, logs), 99, 'rounding never completes a goal early')
assert.equal(fineIsDue(goal, logs), true)
assert.equal(unpaidFine(goal, logs), true)
assert.equal(unpaidFine({ ...goal, fine_paid_at: new Date().toISOString() }, logs), false)
assert.equal(progress({ ...goal, target_value: 99.5 }, logs), 100)
const future = new Date(`${today()}T12:00:00`); future.setDate(future.getDate() + 7)
const currentGoal = { ...goal, deadline: future.toLocaleDateString('en-CA') }
assert.equal(weekCount(currentGoal, [
  { goal_id: 'goal', entry_date: today(), amount: 1 },
  { goal_id: 'goal', entry_date: today(), amount: 1 }
]), 1, 'weekly cadence counts distinct days')
assert.equal(approvalCount({ approval_mode: 'percent', approval_value: 50 }, 3), 2, 'percentage quorum rounds up')
assert.equal(approvalCount({ approval_mode: 'count', approval_value: 2 }, 3), 2, 'absolute quorum uses the configured count')
assert.equal(approvalCount({ approval_mode: 'count', approval_value: 1 }, 0), 0, 'solo group applies immediately')
const recurring = { ...goal, recurrence_type: 'daily', start_date: '2026-10-17', deadline: '2026-10-19', target_value: 4 }
const dailyLogs = [
  { goal_id: 'goal', entry_date: '2026-10-17', amount: 2 },
  { goal_id: 'goal', entry_date: '2026-10-17', amount: 2 },
  { goal_id: 'goal', entry_date: '2026-10-18', amount: 3 }
]
assert.deepEqual(recurringPeriods(recurring, dailyLogs, '2026-10-19').map(p => [p.achieved, p.missed]), [[1, 0], [0, 1], [0, 0]], 'daily goals require the full amount on each date')
assert.equal(recurringProgress(recurring, dailyLogs, '2026-10-19').percent, 33)
assert.equal(recurringFines(recurring, dailyLogs, [], '2026-10-19').length, 1)
assert.equal(recurringFines(recurring, dailyLogs, [{ goal_id: 'goal', period_start: '2026-10-18', occurrence_index: 1 }], '2026-10-19')[0].paid, true)
const weekly = { ...recurring, recurrence_type: 'weekly', start_date: '2026-10-12', deadline: '2026-10-18', weekly_target: 5 }
const weeklyLogs = ['2026-10-12', '2026-10-13', '2026-10-14'].map(entry_date => ({ goal_id: 'goal', entry_date, amount: 4 }))
assert.equal(recurringPeriods(weekly, weeklyLogs, '2026-10-19')[0].missed, 2, 'weekly fine is per missing qualifying day')
assert.equal(recurringFines(weekly, weeklyLogs, [], '2026-10-19').length, 2)
const sodaGoal = { ...weekly, weekly_target: 2, target_value: 1 }
const sodaFreeDays = ['2026-10-12', '2026-10-13', '2026-10-14'].map(entry_date => ({ goal_id: 'goal', entry_date, amount: 1 }))
assert.deepEqual(recurringProgress(sodaGoal, sodaFreeDays, '2026-10-19'), {
  periods: [{ start: '2026-10-12', end: '2026-10-18', expected: 2, achieved: 2, recorded: 3, closed: true, missed: 0 }],
  expected: 2, achieved: 2, recorded: 3, percent: 100
}, 'extra soda-free days remain visible while weekly progress and fines use the minimum')
assert.equal(recurringFines(sodaGoal, sodaFreeDays, [], '2026-10-19').length, 0)
assert.deepEqual(recurringFines({ ...weekly, weekly_target: 4 }, weeklyLogs, [{ goal_id: 'goal', period_start: '2026-10-12', occurrence_index: 2 }], '2026-10-19').map(fine => fine.paid), [true], 'late progress keeps an already paid occurrence settled')
assert.equal(recurringPeriods({ ...weekly, start_date: '2026-10-16' }, [], '2026-10-19')[0].expected, 3, 'partial weeks cannot require more days than available')
const monthly = { ...recurring, recurrence_type: 'monthly', start_date: '2026-01-20', deadline: '2026-03-10', target_value: 10 }
assert.deepEqual(recurringPeriods(monthly, [{ goal_id: 'goal', entry_date: '2026-01-30', amount: 10 }], '2026-03-05').map(p => [p.start, p.end, p.missed]), [['2026-01-20', '2026-01-31', 0], ['2026-02-01', '2026-02-28', 1], ['2026-03-01', '2026-03-10', 0]])
const yearly = { ...recurring, recurrence_type: 'yearly', start_date: '2024-02-29', deadline: '2026-03-01' }
assert.deepEqual(recurringPeriods(yearly, [], '2026-10-19').map(p => p.end), ['2024-12-31', '2025-12-31', '2026-03-01'])
const achievementGoals = [
  { id: 'read', owner_id: 'm1', category: 'Leitura', recurrence_type: 'none', target_value: 1, deadline: '2099-12-31' },
  { id: 'run', owner_id: 'm1', category: 'Saúde', recurrence_type: 'none', target_value: 2, deadline: '2099-12-31' },
  { id: 'daily', owner_id: 'm1', category: 'Saúde', recurrence_type: 'daily', start_date: '2020-01-01', deadline: '2020-01-02', target_value: 1 }
]
const achievementEntries = [
  { goal_id: 'read', entry_date: '2026-10-19', amount: 1 },
  { goal_id: 'run', entry_date: '2026-10-19', amount: 1 },
  { goal_id: 'daily', entry_date: '2020-01-01', amount: 1 }
]
assert.equal(goalIsConcluded(achievementGoals[2], achievementEntries, '2020-01-02'), false, 'recurring goal cannot earn points before its deadline')
assert.equal(goalIsConcluded(achievementGoals[2], achievementEntries, '2020-01-03'), false, 'missed recurring periods do not earn points')
const achievementData = { goals: achievementGoals, entries: achievementEntries }
assert.equal(achievementStats(achievementData, 'm1').points, 100, 'only fully completed goals earn points')
assert.equal(achievementStats(achievementData, 'm1').rank.name, 'Recruta')
assert.equal(achievementStats({ ...achievementData, entries: [...achievementEntries, { goal_id: 'run', entry_date: '2026-10-20', amount: 1 }] }, 'm1').points, 200)
assert.equal(rankForPoints(0).name, 'Betinha', 'everyone starts as Betinha')
console.log('Business rules passed: deadline, progress, recurrence periods and fines, approval quorum')
