import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, validateState } from '../static/chores/state.mjs';
import * as d from '../static/chores/domain.mjs';

function setup(assigned = true, frequency = 'daily', extra = {}) {
  const state = emptyState();
  for (const name of ['Alex', 'Sam', 'Jamie']) d.addMember(state, name);
  const [alex, sam, jamie] = state.household.members.map((person) => person.id);
  d.saveChore(state, { name: 'Dishes', frequency, assignedMemberId: assigned ? alex : '', ...extra }, null, '2026-01-01');
  return { state, alex, sam, jamie, chore: state.chores[0] };
}
const at = (date) => new Date(`${date}T12:00:00`);

test('calendar recurrence handles leap years, month ends, weekdays and DST', () => {
  assert.equal(d.nextDate({ frequency: 'monthly', dayOfMonth: 31 }, '2024-01-31'), '2024-02-29');
  assert.equal(d.nextDate({ frequency: 'monthly', dayOfMonth: 31 }, '2025-02-28'), '2025-03-31');
  assert.equal(d.nextDate({ frequency: 'monthly', dayOfMonth: 1 }, '2026-12-31'), '2027-01-01');
  assert.equal(d.nextDate({ frequency: 'weekly', weekday: 6 }, '2026-01-03'), '2026-01-10');
  assert.equal(d.nextDate({ frequency: 'weekly', weekday: 6 }, '2026-01-03', true), '2026-01-03');
  assert.equal(d.nextDate({ frequency: 'daily' }, '2026-03-08'), '2026-03-09');
  assert.equal(d.nextDate({ frequency: 'daily' }, '2026-11-01'), '2026-11-02');
});
test('completion waits for recurrence, rotates once, and is idempotent', () => {
  const { state, chore, alex, sam } = setup();
  d.completeChore(state, chore.id, null, at('2026-01-01'));
  d.completeChore(state, chore.id, null, at('2026-01-01'));
  assert.equal(state.history.length, 1);
  d.reconcile(state, '2026-01-01');
  assert.equal(chore.assignedMemberId, alex);
  assert.equal(chore.completed, true);
  d.reconcile(state, '2026-01-02');
  assert.equal(chore.assignedMemberId, sam);
  assert.equal(chore.completed, false);
  const snapshot = structuredClone(state);
  d.reconcile(state, '2026-01-02');
  assert.deepEqual(state, snapshot);
  validateState(state);
});
test('overdue chores keep their assignee and completion resumes in the future', () => {
  const { state, chore, alex, sam } = setup();
  d.reconcile(state, '2026-01-10');
  assert.equal(chore.dueDate, '2026-01-01');
  assert.equal(chore.assignedMemberId, alex);
  assert.equal(d.status(chore, '2026-01-10'), 'Overdue');
  d.completeChore(state, chore.id, null, at('2026-01-10'));
  assert.equal(chore.nextOccurrenceDate, '2026-01-11');
  d.reconcile(state, '2026-01-11');
  assert.equal(chore.assignedMemberId, sam);
});
test('missed visits generate one pending occurrence, not a backlog', () => {
  const { state, chore, sam } = setup();
  d.completeChore(state, chore.id, null, at('2026-01-01'));
  d.reconcile(state, '2026-02-01');
  assert.equal(chore.dueDate, '2026-01-02');
  assert.equal(chore.assignedMemberId, sam);
  assert.equal(state.history.length, 1);
  d.reconcile(state, '2026-02-10');
  assert.equal(chore.assignedMemberId, sam);
});
test('first unassigned occurrence stays unassigned until its next recurrence', () => {
  const { state, chore, alex } = setup(false);
  d.reconcile(state, '2026-01-01');
  assert.equal(chore.assignedMemberId, null);
  d.reconcile(state, '2026-01-05');
  assert.equal(chore.assignedMemberId, alex);
  assert.equal(chore.dueDate, '2026-01-05');
  d.reconcile(state, '2026-01-06');
  assert.equal(chore.assignedMemberId, alex);
  assert.equal(chore.dueDate, '2026-01-05');
});
test('empty households wait until a recurrence with members', () => {
  const state = emptyState();
  d.saveChore(state, { name: 'Trash', frequency: 'daily' }, null, '2026-01-01');
  d.reconcile(state, '2026-01-05');
  assert.equal(state.chores[0].assignedMemberId, null);
  d.addMember(state, 'Alex');
  d.reconcile(state, '2026-01-05');
  assert.equal(state.chores[0].assignedMemberId, null);
  d.reconcile(state, '2026-01-06');
  assert.equal(state.chores[0].assignedMemberId, state.household.members[0].id);
  validateState(state);
});
test('manual reassignment and reordering preserve the rotation anchor', () => {
  const { state, chore, alex, sam, jamie } = setup();
  d.reassignChore(state, chore.id, jamie);
  assert.equal(chore.rotationMemberId, alex);
  d.completeChore(state, chore.id, null, at('2026-01-01'));
  assert.equal(state.history[0].memberName, 'Jamie');
  d.reconcile(state, '2026-01-02');
  assert.equal(chore.assignedMemberId, sam);
  d.moveMember(state, jamie, -1); // Alex, Jamie, Sam
  d.completeChore(state, chore.id, null, at('2026-01-02'));
  d.reconcile(state, '2026-01-03');
  assert.equal(chore.assignedMemberId, alex);
});
test('removal requires reassignment and preserves the next successor', () => {
  const { state, chore, alex, sam, jamie } = setup();
  assert.throws(() => d.removeMember(state, alex), /Reassign/);
  d.reassignChore(state, chore.id, jamie);
  d.removeMember(state, alex);
  d.completeChore(state, chore.id, null, at('2026-01-01'));
  d.reconcile(state, '2026-01-02');
  assert.equal(chore.assignedMemberId, sam);
  validateState(state);
});
test('history stores snapshots, caps at 20, and survives deletion', () => {
  const { state, chore, alex } = setup();
  for (let day = 1; day <= 22; day++) {
    const date = `2026-01-${String(day).padStart(2, '0')}`;
    d.reconcile(state, date);
    d.completeChore(state, chore.id, null, at(date));
  }
  assert.equal(state.history.length, 20);
  assert.equal(state.history.at(-1).completedAt, at('2026-01-03').toISOString());
  d.deleteChore(state, chore.id);
  d.removeMember(state, alex);
  assert.equal(state.history[0].choreName, 'Dishes');
  assert.equal(state.history[0].memberName, 'Alex');
  validateState(state);
});
test('unassigned completion requires a member and preserves assignment', () => {
  const { state, chore, sam } = setup(false);
  assert.throws(() => d.completeChore(state, chore.id, null, at('2026-01-01')), /member/);
  d.completeChore(state, chore.id, sam, at('2026-01-01'));
  assert.equal(state.history[0].memberName, 'Sam');
  assert.equal(chore.assignedMemberId, null);
});
test('edit retains current status unless the recurrence changes', () => {
  const { state, chore, alex, jamie } = setup();
  d.completeChore(state, chore.id, null, at('2026-01-01'));
  d.saveChore(state, { name: 'Wash dishes', frequency: 'daily', assignedMemberId: jamie }, chore.id, '2026-01-01');
  assert.equal(chore.completed, true);
  assert.equal(chore.rotationMemberId, alex);
  d.saveChore(state, { name: 'Wash dishes', frequency: 'monthly', dayOfMonth: 31, assignedMemberId: jamie }, chore.id, '2026-02-01');
  assert.equal(chore.completed, false);
  assert.equal(chore.dueDate, '2026-02-28');
  validateState(state);
});
test('invalid names, recurrence and dangling references are rejected', () => {
  const { state, chore } = setup();
  assert.throws(() => d.addMember(state, '   '));
  assert.throws(() => d.renameHousehold(state, ''));
  assert.throws(() => d.saveChore(state, { name: 'Bad', frequency: 'monthly', dayOfMonth: 32 }));
  assert.throws(() => d.reassignChore(state, chore.id, 'missing'));
  chore.assignedMemberId = 'missing';
  assert.throws(() => validateState(state));
});
