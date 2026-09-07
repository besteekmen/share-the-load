import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, emptyState, STORAGE_KEY } from '../static/chores/state.mjs';

function memoryStorage(initial = null) {
  const data = new Map(initial === null ? [] : [[STORAGE_KEY, initial]]);
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

test('first visit starts empty and changes survive reopening', () => {
  const storage = memoryStorage();
  const store = createStore(() => storage);
  assert.deepEqual(store.getState(), emptyState());
  store.update((state) => {
    state.household.name = 'Our home';
    state.dismissedSuggestions = true;
  });
  assert.deepEqual(createStore(() => storage).getState(), store.getState());
  const copy = store.getState();
  copy.household.name = 'Unsaved';
  assert.equal(store.getState().household.name, 'Our home');
});

for (const raw of ['{broken', 'null', JSON.stringify({ ...emptyState(), version: 99 }),
  JSON.stringify({ ...emptyState(), chores: [null] })]) {
  test(`invalid data is preserved: ${raw}`, () => {
    const storage = memoryStorage(raw);
    const store = createStore(() => storage);
    assert.ok(store.getError());
    assert.deepEqual(store.getState(), emptyState());
    assert.throws(() => store.update((state) => { state.dismissedSuggestions = true; }));
    assert.equal(storage.getItem(STORAGE_KEY), raw);
  });
}

test('blocked storage access produces a usable empty state', () => {
  const store = createStore(() => { throw new Error('Storage blocked'); });
  assert.equal(store.getError(), 'Storage blocked');
  assert.deepEqual(store.getState(), emptyState());
});

test('failed writes keep previously saved data and in-memory state', () => {
  const storage = memoryStorage();
  const store = createStore(() => storage);
  const saved = storage.getItem(STORAGE_KEY);
  storage.setItem = () => { throw new Error('Storage full'); };
  assert.throws(() => store.update((state) => { state.dismissedSuggestions = true; }), /Storage full/);
  assert.equal(store.getState().dismissedSuggestions, false);
  assert.equal(storage.getItem(STORAGE_KEY), saved);
});

test('stale tabs cannot overwrite newer changes', () => {
  const storage = memoryStorage();
  const first = createStore(() => storage);
  const second = createStore(() => storage);
  first.update((state) => { state.household.name = 'New name'; });
  assert.throws(() => second.update((state) => { state.dismissedSuggestions = true; }), /another tab/);
  assert.equal(createStore(() => storage).getState().household.name, 'New name');
});

test('a failed change callback or validation preserves state and permits retry', () => {
  const storage = memoryStorage();
  const store = createStore(() => storage);
  const saved = storage.getItem(STORAGE_KEY);
  assert.throws(() => store.update((state) => { state.household.name = 'Partial'; throw new Error('Rejected'); }));
  assert.throws(() => store.update((state) => { state.household.members.push({ id: 'bad', name: '' }); }));
  assert.equal(storage.getItem(STORAGE_KEY), saved);
  assert.deepEqual(store.getState(), emptyState());
  assert.equal(store.getError(), null);
  store.update((state) => { state.household.name = 'Valid'; });
  assert.equal(createStore(() => storage).getState().household.name, 'Valid');
});

test('read failures and first-visit write failures disable saving without crashing', () => {
  for (const storage of [
    { getItem() { throw new Error('Read blocked'); } },
    { getItem: () => null, setItem() { throw new Error('Write blocked'); } },
  ]) {
    const store = createStore(() => storage);
    assert.ok(store.getError());
    assert.deepEqual(store.getState(), emptyState());
    assert.throws(() => store.update(() => {}));
  }
});

const corruptions = [
  ['duplicate member IDs', (s) => s.household.members.push({ ...s.household.members[0] })],
  ['invalid calendar date', (s) => { s.chores[0].dueDate = '2026-02-30'; }],
  ['invalid next date order', (s) => { s.chores[0].nextOccurrenceDate = s.chores[0].dueDate; }],
  ['missing assignee', (s) => { s.chores[0].assignedMemberId = 'missing'; }],
  ['missing rotation member', (s) => { s.chores[0].rotationMemberId = 'missing'; }],
  ['invalid completion timestamp', (s) => { s.chores[0].completed = true; s.chores[0].completedAt = 'broken'; }],
  ['invalid history name', (s) => { s.history[0].memberName = ''; }],
  ['duplicate chore IDs', (s) => s.chores.push({ ...s.chores[0] })],
  ['duplicate history IDs', (s) => s.history.push({ ...s.history[0] })],
  ['oversized history', (s) => { s.history = Array.from({ length: 21 }, (_, i) => ({ ...s.history[0], id: String(i) })); }],
];
for (const [label, corrupt] of corruptions) {
  test(`malformed saved records remain untouched: ${label}`, async () => {
    const d = await import('../static/chores/domain.mjs');
    const state = emptyState();
    d.addMember(state, 'Alex');
    d.saveChore(state, { name: 'Dishes', frequency: 'daily', assignedMemberId: state.household.members[0].id }, null, '2026-01-01');
    d.completeChore(state, state.chores[0].id, null, new Date('2026-01-01T12:00:00'));
    corrupt(state);
    const raw = JSON.stringify(state);
    const storage = memoryStorage(raw);
    const store = createStore(() => storage);
    assert.ok(store.getError());
    assert.throws(() => store.update(() => {}));
    assert.equal(storage.getItem(STORAGE_KEY), raw);
  });
}
