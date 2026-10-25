import assert from 'node:assert/strict'
import { build } from 'esbuild'

async function loadModule(path) {
  const result = await build({ entryPoints: [new URL(path, import.meta.url).pathname], bundle: true, platform: 'node', format: 'esm', write: false })
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
}
const { completed, progress, fineIsDue, unpaidFine, weekCount, approvalCount, today, formatEntryTimestamp } = await loadModule('../src/types.ts')
const { recurringPeriods, recurringProgress, recurringFines, isScheduledDay, selectedWeekdayCount } = await loadModule('../src/recurrence.ts')
const { achievementStats, goalIsConcluded, goalHasFailed, rankForPoints, displayedRank, ranks } = await loadModule('../src/achievements.ts')
const { pendingFines } = await loadModule('../src/fines.ts')
const { checkoutRecords } = await loadModule('../src/checkouts.ts')
const { heartStatus, recoverDemoYesterday, recoverableYesterday, yesterdayInBrazil } = await loadModule('../src/hearts.ts')
const yesterday = new Date(`${today()}T12:00:00`); yesterday.setDate(yesterday.getDate() - 1)
assert.equal(formatEntryTimestamp('2026-10-23T13:45:00Z'), '23/10/2026 às 10:45', 'stored timestamps display in Brasília time')
assert.equal(formatEntryTimestamp('2026-10-24T01:15:00Z'), '23/10/2026 às 22:15', 'the displayed date follows Brasília across UTC midnight')
assert.equal(formatEntryTimestamp('2026-10-23'), null, 'legacy demo dates without a recorded hour do not invent one')
const yesterdayForHearts = yesterdayInBrazil()
const heartNow = new Date()
const heartGoals = ['water', 'reading'].map(id => ({ id, group_id: 'family', owner_id: 'm1', title: id, recurrence_type: 'daily', start_date: yesterdayForHearts, deadline: '2099-12-31', target_value: 1, weekday_mask: null, rest_dates: [] }))
const heartData = { group: { id: 'family' }, me: 'm1', goals: heartGoals, entries: [], finePayments: [], heartSpends: [] }
assert.equal(recoverableYesterday(heartData).length, 2)
const firstHeartUse = recoverDemoYesterday(heartData, yesterdayForHearts, ['water'], heartNow)
assert.equal(heartStatus(firstHeartUse.heartSpends, heartNow).available, 2)
const sameDayUse = recoverDemoYesterday(firstHeartUse, yesterdayForHearts, ['reading'], heartNow)
assert.equal(heartStatus(sameDayUse.heartSpends, heartNow).available, 2, 'several goals from yesterday share one heart')
assert.deepEqual(sameDayUse.entries.map(entry => entry.goal_id).sort(), ['reading', 'water'])
assert.equal(heartStatus(sameDayUse.heartSpends, new Date(heartNow.getTime() + 30 * 86400000 - 1000)).available, 2)
assert.equal(heartStatus(sameDayUse.heartSpends, new Date(heartNow.getTime() + 30 * 86400000)).available, 3, 'each spent heart returns exactly after 30 days')
assert.throws(() => recoverDemoYesterday(heartData, '2020-01-01', ['water'], heartNow), /dia anterior/)
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
const fineData = {
  goals: [
    { ...goal, id: 'one', owner_id: 'm1', title: 'Livro', unit: 'páginas', target_value: 10, deadline: '2026-10-18', fine_amount: 30, recurrence_type: 'none' },
    { ...recurring, id: 'daily', owner_id: 'm2', title: 'Água', unit: 'litros', start_date: '2026-10-18', deadline: '2026-10-20', fine_amount: 5 },
    { ...weekly, id: 'weekly', owner_id: 'm1', title: 'Inglês', unit: 'minutos', start_date: '2026-10-12', deadline: '2026-10-18', weekly_target: 2, target_value: 20, fine_amount: 10 }
  ],
  entries: [
    { goal_id: 'one', entry_date: '2026-10-18', amount: 4 },
    { goal_id: 'daily', entry_date: '2026-10-18', amount: 4 },
    { goal_id: 'weekly', entry_date: '2026-10-12', amount: 20 }
  ],
  finePayments: [{ goal_id: 'daily', period_start: '2026-10-19', occurrence_index: 1 }]
}
const openFines = pendingFines(fineData, '2026-10-21')
const checkoutSample = checkoutRecords({ goals: [{ id: 'water', target_value: 2 }, { id: 'read', target_value: 1 }], entries: [
  { id: 'a', goal_id: 'water', author_id: 'm1', entry_date: '2026-10-19', created_at: '2026-10-19T13:00:00Z', amount: 1 },
  { id: 'b', goal_id: 'water', author_id: 'm1', entry_date: '2026-10-19', created_at: '2026-10-19T14:00:00Z', amount: 1 },
  { id: 'c', goal_id: 'read', author_id: 'm2', entry_date: '2026-10-18', created_at: '2026-10-20T13:00:00Z', amount: 1 },
  { id: 'orphan', goal_id: 'deleted', author_id: 'm2', entry_date: '2026-10-20', created_at: '2026-10-21T13:00:00Z', amount: 1 }
] })
assert.deepEqual(checkoutSample.map(record => [record.entry.id, record.dayTotal]), [['c', 1], ['b', 2], ['a', 2]], 'checkouts list newest registrations first and show the completed day total')
assert.deepEqual(openFines.map(fine => [fine.goal.owner_id, fine.goal.title, fine.amount]), [['m1', 'Inglês', 10], ['m1', 'Livro', 30], ['m2', 'Água', 5]], 'the ledger lists each unpaid fine with its debtor and amount')
assert.match(openFines[0].reason, /1 de 2 dias exigidos/)
assert.match(openFines[1].reason, /4 páginas registrados/)
assert.match(openFines[2].label, /20\/10\/2026/)
assert.equal(pendingFines({ ...fineData, goals: fineData.goals.map(g => g.id === 'one' ? { ...g, fine_paid_at: '2026-10-21' } : g) }, '2026-10-21').reduce((sum, fine) => sum + fine.amount, 0), 15, 'paid fines leave the pending total')
assert.equal(recurringPeriods({ ...weekly, start_date: '2026-10-16' }, [], '2026-10-19')[0].expected, 3, 'partial weeks cannot require more days than available')
const weekdaysGoal = { ...weekly, target_value: 1, weekday_mask: 31, weekly_target: 5 }
const weekdayLogs = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-17'].map(entry_date => ({ goal_id: 'goal', entry_date, amount: 1 }))
assert.equal(selectedWeekdayCount(31), 5)
assert.equal(isScheduledDay(weekdaysGoal, '2026-10-16'), true)
assert.equal(isScheduledDay(weekdaysGoal, '2026-10-17'), false)
assert.deepEqual(recurringPeriods(weekdaysGoal, weekdayLogs, '2026-10-19').map(p => [p.expected, p.achieved, p.missed]), [[5, 4, 1]], 'weekends do not replace a required weekday')
assert.equal(recurringFines(weekdaysGoal, weekdayLogs, [], '2026-10-19').length, 1)
const dailyWithRest = { ...recurring, start_date: '2026-10-19', deadline: '2026-10-25', target_value: 1, weekday_mask: 31, rest_dates: ['2026-10-21'] }
assert.equal(isScheduledDay(dailyWithRest, '2026-10-21'), false, 'one-off holiday is skipped')
assert.equal(isScheduledDay(dailyWithRest, '2026-10-24'), false, 'regular Saturday rest is skipped')
assert.equal(isScheduledDay(dailyWithRest, '2026-10-22'), true, 'other weekdays remain active')
assert.deepEqual(recurringPeriods(dailyWithRest, [{ goal_id: 'goal', entry_date: '2026-10-19', amount: 1 }], '2026-10-26').map(p => [p.start, p.missed]), [['2026-10-19', 0], ['2026-10-20', 1], ['2026-10-22', 1], ['2026-10-23', 1]], 'daily evaluation skips rest days but keeps a separate fine for every missed active day')
assert.equal(recurringFines(dailyWithRest, [{ goal_id: 'goal', entry_date: '2026-10-19', amount: 1 }], [], '2026-10-26').length, 3)
assert.deepEqual(recurringPeriods({ ...dailyWithRest, weekday_mask: null }, [], '2026-10-26').map(p => p.start), ['2026-10-19', '2026-10-20', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'], 'one-off holiday also works when every weekday is normally active')
assert.deepEqual(recurringPeriods({ ...weekdaysGoal, start_date: '2026-10-15' }, [], '2026-10-19').map(p => [p.expected, p.missed]), [[2, 2]], 'partial weeks only require scheduled days inside the goal range')
assert.equal(recurringPeriods({ ...weekly, target_value: 1 }, weekdayLogs, '2026-10-19')[0].achieved, 5, 'existing flexible weekly goals still accept any days')
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
const achievementData = { goals: achievementGoals.slice(0, 2), entries: achievementEntries, members: [{ id: 'm1', selected_rank: null }] }
assert.equal(achievementStats(achievementData, 'm1').points, 100, 'only fully completed goals earn points')
assert.equal(achievementStats(achievementData, 'm1').rank.name, 'Recruta')
assert.equal(achievementStats({ ...achievementData, entries: [...achievementEntries, { goal_id: 'run', entry_date: '2026-10-20', amount: 1 }] }, 'm1').points, 200)
assert.equal(goalHasFailed(achievementGoals[2], achievementEntries, '2020-01-03'), true)
assert.equal(achievementStats({ ...achievementData, goals: achievementGoals }, 'm1').points, 0, 'an expired failed goal removes 100 points once')
assert.equal(achievementStats({ ...achievementData, goals: achievementGoals }, 'm1').failedGoals.length, 1)
assert.equal(displayedRank(100, 'Betinha').name, 'Betinha', 'members may wear an unlocked lower rank')
assert.equal(displayedRank(0, 'Recruta').name, 'Betinha', 'lost points remove access to higher ranks')
assert.ok(ranks.length >= 20, 'the rank ladder offers many steps')
assert.equal(rankForPoints(0).name, 'Betinha', 'everyone starts as Betinha')
console.log('Business rules passed: deadline, progress, recurrence periods and fines, approval quorum')
