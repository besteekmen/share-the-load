import { validDate, validRule } from './domain.mjs';

export const STORAGE_KEY = 'share-the-load.state';
export const VERSION = 1;

export function emptyState() {
  return {
    version: VERSION,
    household: { name: '', members: [] },
    chores: [],
    history: [],
    dismissedSuggestions: false,
  };
}

export function validateState(state) {
  const records = (value) => Array.isArray(value) && value.every(
    (item) => item !== null && typeof item === 'object' && !Array.isArray(item),
  );
  if (!state || state.version !== VERSION ||
      typeof state.household?.name !== 'string' ||
      !records(state.household.members) || !records(state.chores) ||
      !records(state.history) || state.history.length > 20 ||
      typeof state.dismissedSuggestions !== 'boolean') {
    throw new Error('Stored household data is invalid or uses an unsupported version. Existing data has been left untouched.');
  }
  const fail = () => { throw new Error('Stored household data is invalid. Existing data has been left untouched.'); };
  const text = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 100;
  const uniqueIds = (items) => items.every((item) => text(item.id)) && new Set(items.map((item) => item.id)).size === items.length;
  const members = state.household.members;
  const memberRef = (value) => value === null || members.some((item) => item.id === value);
  const timestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
  if (state.household.name.length > 100 || !uniqueIds(members) || !uniqueIds(state.chores) || !uniqueIds(state.history) ||
      !members.every((item) => text(item.name)) ||
      !state.chores.every((item) => text(item.name) && validRule(item) && validDate(item.dueDate) &&
        validDate(item.nextOccurrenceDate) && item.nextOccurrenceDate > item.dueDate &&
        memberRef(item.assignedMemberId) && memberRef(item.rotationMemberId) &&
        typeof item.completed === 'boolean' && typeof item.awaitingFirstAssignment === 'boolean' &&
        (item.completed ? timestamp(item.completedAt) : item.completedAt === null)) ||
      !state.history.every((item) => text(item.choreName) && text(item.memberName) && timestamp(item.completedAt))) fail();
  return state;
}

// Resolve localStorage inside the guarded operation: even accessing it may throw.
export function createStore(getStorage = () => window.localStorage) {
  let state = emptyState();
  let storage;
  let lastSaved;
  let error = null;
  try {
    storage = getStorage();
    lastSaved = storage.getItem(STORAGE_KEY);
    if (lastSaved === null) {
      lastSaved = JSON.stringify(state);
      storage.setItem(STORAGE_KEY, lastSaved);
    } else {
      state = validateState(JSON.parse(lastSaved));
    }
  } catch (cause) {
    error = cause instanceof SyntaxError
      ? 'Stored household data could not be read. Existing data has been left untouched.'
      : cause.message || 'Browser storage is unavailable.';
  }
  return {
    getState: () => structuredClone(state),
    getError: () => error,
    update(change) {
      if (error) throw new Error(error);
      const next = structuredClone(state);
      change(next);
      validateState(next);
      try {
        // Avoid replacing newer data written by another open tab.
        if (storage.getItem(STORAGE_KEY) !== lastSaved) {
          throw new Error('Household data changed in another tab. Reload this page before making changes.');
        }
        const serialized = JSON.stringify(next);
        storage.setItem(STORAGE_KEY, serialized);
        lastSaved = serialized;
        state = next;
      } catch (cause) {
        error = cause.message || 'Changes could not be saved in this browser.';
        throw new Error(error);
      }
      return structuredClone(state);
    },
  };
}
