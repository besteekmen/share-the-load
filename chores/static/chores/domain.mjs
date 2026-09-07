// Calendar arithmetic uses local noon, avoiding UTC conversion and DST day lengths.
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && localDate(parseDate(value)) === value;
}
export function validRule(rule) {
  return rule.frequency === 'daily' ||
    (rule.frequency === 'weekly' && Number.isInteger(rule.weekday) && rule.weekday >= 0 && rule.weekday <= 6) ||
    (rule.frequency === 'monthly' && Number.isInteger(rule.dayOfMonth) && rule.dayOfMonth >= 1 && rule.dayOfMonth <= 31);
}
export function nextDate(rule, from, inclusive = false) {
  const date = parseDate(from);
  if (!inclusive) date.setDate(date.getDate() + 1);
  if (rule.frequency === 'weekly') {
    date.setDate(date.getDate() + (rule.weekday - date.getDay() + 7) % 7);
  } else if (rule.frequency === 'monthly') {
    const target = (year, month) => new Date(year, month, Math.min(rule.dayOfMonth, new Date(year, month + 1, 0).getDate()), 12);
    let candidate = target(date.getFullYear(), date.getMonth());
    if (candidate < date) candidate = target(date.getFullYear(), date.getMonth() + 1);
    return localDate(candidate);
  }
  return localDate(date);
}
const id = () => crypto.randomUUID();
function name(value) {
  const result = String(value ?? '').trim();
  if (!result) throw new Error('Please enter a name.');
  if (result.length > 100) throw new Error('Names must be 100 characters or fewer.');
  return result;
}
function member(state, memberId) {
  const found = state.household.members.find((item) => item.id === memberId);
  if (!found) throw new Error('Choose an existing household member.');
  return found;
}
function chore(state, choreId) {
  const found = state.chores.find((item) => item.id === choreId);
  if (!found) throw new Error('This chore no longer exists.');
  return found;
}
export function renameHousehold(state, value) { state.household.name = name(value); }
export function addMember(state, value) { state.household.members.push({ id: id(), name: name(value) }); }
export function moveMember(state, memberId, direction) {
  const members = state.household.members;
  const index = members.findIndex((item) => item.id === memberId);
  if (index < 0 || ![-1, 1].includes(direction)) throw new Error('Invalid member move.');
  const next = index + direction;
  if (next >= 0 && next < members.length) [members[index], members[next]] = [members[next], members[index]];
}
export function removeMember(state, memberId) {
  member(state, memberId);
  if (state.chores.some((item) => item.assignedMemberId === memberId)) {
    throw new Error('Reassign this member’s chores before removing them (including completed chores).');
  }
  const members = state.household.members;
  const index = members.findIndex((item) => item.id === memberId);
  // Anchor to their predecessor so the next turn goes to the removed member's successor.
  const predecessor = members.length > 1 ? members[(index + members.length - 1) % members.length].id : null;
  for (const item of state.chores) {
    if (item.rotationMemberId === memberId) item.rotationMemberId = predecessor;
  }
  members.splice(index, 1);
}
function fields(state, input) {
  const result = {
    name: name(input.name), frequency: input.frequency,
    weekday: input.frequency === 'weekly' ? Number(input.weekday) : null,
    dayOfMonth: input.frequency === 'monthly' ? Number(input.dayOfMonth) : null,
    assignedMemberId: input.assignedMemberId || null,
  };
  if (!validRule(result)) throw new Error('Choose a valid recurrence schedule.');
  if (result.assignedMemberId) member(state, result.assignedMemberId);
  return result;
}
export function saveChore(state, input, choreId = null, today = localDate()) {
  const values = fields(state, input);
  if (choreId) {
    const current = chore(state, choreId);
    const changed = ['frequency', 'weekday', 'dayOfMonth'].some((key) => current[key] !== values[key]);
    Object.assign(current, values);
    if (values.assignedMemberId) current.awaitingFirstAssignment = false;
    if (changed) {
      current.dueDate = nextDate(values, today, true);
      current.nextOccurrenceDate = nextDate(values, current.dueDate);
      current.completed = false;
      current.completedAt = null;
    }
  } else {
    const dueDate = nextDate(values, today, true);
    state.chores.push({
      id: id(), ...values, dueDate, nextOccurrenceDate: nextDate(values, dueDate),
      rotationMemberId: values.assignedMemberId, awaitingFirstAssignment: !values.assignedMemberId,
      completed: false, completedAt: null,
    });
    state.dismissedSuggestions = true;
  }
}
export function deleteChore(state, choreId) {
  chore(state, choreId);
  state.chores = state.chores.filter((item) => item.id !== choreId);
}
export function reassignChore(state, choreId, memberId) {
  if (memberId) member(state, memberId);
  const current = chore(state, choreId);
  current.assignedMemberId = memberId || null;
  current.awaitingFirstAssignment = false;
}
export function completeChore(state, choreId, completedBy = null, now = new Date()) {
  const current = chore(state, choreId);
  if (current.completed) return;
  const person = member(state, current.assignedMemberId || completedBy);
  current.completed = true;
  current.completedAt = now.toISOString();
  current.awaitingFirstAssignment = false;
  current.nextOccurrenceDate = nextDate(current, current.dueDate > localDate(now) ? current.dueDate : localDate(now));
  state.history.unshift({ id: id(), choreName: current.name, memberName: person.name, completedAt: current.completedAt });
  state.history = state.history.slice(0, 20);
}
export function reconcile(state, today = localDate()) {
  for (const current of state.chores) {
    if (current.nextOccurrenceDate > today || (!current.completed && !current.awaitingFirstAssignment)) continue;
    // Catch up initial unassigned chores without manufacturing missed completions.
    let due = current.nextOccurrenceDate;
    if (current.awaitingFirstAssignment) {
      let next = nextDate(current, due);
      while (next <= today) { due = next; next = nextDate(current, due); }
    }
    current.dueDate = due;
    current.nextOccurrenceDate = nextDate(current, due);
    current.completed = false;
    current.completedAt = null;
    const members = state.household.members;
    if (members.length) {
      const previous = members.findIndex((item) => item.id === current.rotationMemberId);
      const next = members[(previous + 1) % members.length];
      current.assignedMemberId = next.id;
      current.rotationMemberId = next.id;
      current.awaitingFirstAssignment = false;
    } else {
      current.assignedMemberId = null;
      current.rotationMemberId = null;
      current.awaitingFirstAssignment = true;
    }
  }
}
export function status(current, today = localDate()) {
  return current.completed ? 'Done' : current.dueDate < today ? 'Overdue' : 'To Do';
}
export function displayedDate(current) { return current.completed ? current.nextOccurrenceDate : current.dueDate; }
