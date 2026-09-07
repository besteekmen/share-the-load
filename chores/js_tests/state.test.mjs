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
