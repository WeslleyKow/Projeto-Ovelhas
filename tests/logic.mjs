import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/types.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { completed, progress, fineIsDue, unpaidFine, weekCount, approvalCount, today } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
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
const future = new Date(); future.setDate(future.getDate() + 7)
const currentGoal = { ...goal, deadline: future.toLocaleDateString('en-CA') }
assert.equal(weekCount(currentGoal, [
  { goal_id: 'goal', entry_date: today(), amount: 1 },
  { goal_id: 'goal', entry_date: today(), amount: 1 }
]), 1, 'weekly cadence counts distinct days')
assert.equal(approvalCount({ approval_mode: 'percent', approval_value: 50 }, 3), 2, 'percentage quorum rounds up')
assert.equal(approvalCount({ approval_mode: 'count', approval_value: 2 }, 3), 2, 'absolute quorum uses the configured count')
assert.equal(approvalCount({ approval_mode: 'count', approval_value: 1 }, 0), 0, 'solo group applies immediately')
console.log('Business rules passed: deadline, progress, fine, weekly cadence, approval quorum')
