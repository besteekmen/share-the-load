import { createStore, STORAGE_KEY } from './state.mjs';
import * as domain from './domain.mjs';

const $ = (selector) => document.querySelector(selector);
let store = createStore();
let editingId = null;
let personAction = null;
let lastDay = domain.localDate();
const choreForm = $('#chore-form');
const dialog = $('#person-dialog');
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(text, action, id, label = text) {
  const node = element('button', text);
  node.type = 'button';
  node.dataset.action = action;
  node.dataset.id = id;
  node.id = `${action}-${id}`;
  node.setAttribute('aria-label', label);
  node.disabled = Boolean(store.getError());
  return node;
}
function options(select, members, emptyLabel, selected = select.value) {
  select.replaceChildren();
  if (emptyLabel) select.add(new Option(emptyLabel, ''));
  for (const member of members) select.add(new Option(member.name, member.id));
  if ([...select.options].some((option) => option.value === selected)) select.value = selected;
}
function say(text, error = false) {
  const node = $('#message');
  node.hidden = !text;
  node.textContent = text;
  node.className = error ? 'notice' : 'feedback';
  if (error) node.focus();
}
function update(change, message) {
  try {
    store.update((state) => { domain.reconcile(state); change(state); });
    render();
    say(message);
    return true;
  } catch (error) {
    render();
    say(error.message, true);
    return false;
  }
}
function formatDate(date) {
  return domain.parseDate(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function frequency(chore) {
  if (chore.frequency === 'weekly') return `Weekly · ${weekdays[chore.weekday]}`;
  if (chore.frequency === 'monthly') return `Monthly · day ${chore.dayOfMonth}`;
  return 'Daily';
}
function render() {
  const focused = document.activeElement?.id;
  const openMenus = new Set([...document.querySelectorAll('.row-menu[open]')].map((node) => node.id));
  const state = store.getState();
  const members = state.household.members;
  $('#today-label').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  $('#household-name').textContent = state.household.name || 'Your household';
  const nameInput = $('#household-form').elements.name;
  if (document.activeElement !== nameInput) nameInput.value = state.household.name;
  options($('#chore-assignee'), members, 'Unassigned');
  options($('#member-filter'), members, 'All members');
  $('#suggestions').hidden = state.dismissedSuggestions || state.chores.length > 0;
  const error = store.getError();
  $('#storage-error').hidden = !error;
  $('#storage-error').textContent = error ? `Saving is disabled. ${error}` : '';
  for (const node of document.querySelectorAll('button[type="submit"], #dismiss-suggestions')) node.disabled = Boolean(error);

  const memberList = $('#member-list');
  memberList.replaceChildren();
  if (!members.length) memberList.append(element('li', 'No members yet.', 'hint'));
  members.forEach((member, index) => {
    const row = element('li', undefined, 'member-row');
    row.append(element('span', `${index + 1}. ${member.name}`));
    const actions = element('div', undefined, 'actions');
    const up = button('↑', 'up', member.id, `Move ${member.name} up`);
    const down = button('↓', 'down', member.id, `Move ${member.name} down`);
    up.disabled ||= index === 0;
    down.disabled ||= index === members.length - 1;
    actions.append(up, down, button('Remove', 'remove', member.id, `Remove ${member.name}`));
    row.append(actions);
    memberList.append(row);
  });

  const filter = $('#member-filter').value;
  const chores = state.chores.filter((chore) => !filter || domain.displayedMemberId(chore, members) === filter)
    .sort((a, b) => domain.displayedDate(a).localeCompare(domain.displayedDate(b)));
  $('#chore-count').textContent = `${chores.length} ${chores.length === 1 ? 'chore' : 'chores'}`;
  const list = $('#chore-list');
  list.replaceChildren();
  if (!chores.length) {
    const empty = element('div', undefined, 'empty');
    empty.append(element('h3', filter ? 'No chores for this person' : 'No chores yet'),
      element('p', filter ? 'Choose another person or view all members.' : 'Add a recurring chore to start sharing the load.'));
    list.append(empty);
  }
  let group = '';
  for (const chore of chores) {
    const due = domain.displayedDate(chore);
    const section = due < lastDay ? 'Past due' : due === lastDay ? 'Today' : 'Upcoming';
    if (section !== group) { list.append(element('h3', section, 'list-heading')); group = section; }
    const row = element('article', undefined, 'chore-row');
    const description = element('div', undefined, 'chore-description');
    const displayedMemberId = domain.displayedMemberId(chore, members);
    const assigned = members.find((member) => member.id === displayedMemberId)?.name || 'Unassigned';
    description.append(element('h4', chore.name), element('p', `${assigned} · ${frequency(chore)}`),
      element('p', `${chore.completed ? 'Next' : 'Due'}: ${formatDate(due)}`, 'due-date'));
    const status = domain.status(chore);
    const icons = { 'To Do': '○', Done: '✓', Overdue: '!' };
    description.append(element('span', `${icons[status]} ${status}`, `status ${status.toLowerCase().replace(' ', '-')}`));
    const actions = element('div', undefined, 'row-actions');
    const done = button('Done', 'done', chore.id, `Mark ${chore.name} done`);
    done.disabled ||= chore.completed;
    const menu = element('details', undefined, 'row-menu');
    menu.id = `menu-${chore.id}`;
    menu.open = openMenus.has(menu.id);
    const summary = element('summary', '⋯');
    summary.id = `options-${chore.id}`;
    summary.setAttribute('aria-label', `Options for ${chore.name}`);
    const menuItems = element('div', undefined, 'menu-items');
    menuItems.append(button('Reassign', 'reassign', chore.id), button('Edit', 'edit', chore.id), button('Delete', 'delete', chore.id));
    menu.append(summary, menuItems);
    actions.append(done, menu);
    row.append(description, actions);
    list.append(row);
  }
  const history = $('#history-list');
  history.replaceChildren();
  if (!state.history.length) history.append(element('p', 'No completions yet. Your 20 most recent completions will appear here.'));
  else {
    const entries = element('ol', undefined, 'history-entries');
    for (const entry of state.history) {
      const row = element('li');
      row.append(element('strong', entry.choreName), element('span', `${entry.memberName} · ${new Date(entry.completedAt).toLocaleString()}`));
      entries.append(row);
    }
    history.append(entries);
  }
  if (focused && document.getElementById(focused)) document.getElementById(focused).focus();
}
function scheduleFields() {
  const frequency = choreForm.elements.frequency.value;
  $('#weekday-field').hidden = frequency !== 'weekly';
  $('#monthday-field').hidden = frequency !== 'monthly';
  choreForm.elements.weekday.disabled = frequency !== 'weekly';
  choreForm.elements.dayOfMonth.disabled = frequency !== 'monthly';
  choreForm.elements.dayOfMonth.required = frequency === 'monthly';
}
function closeEditor() {
  editingId = null;
  choreForm.reset();
  scheduleFields();
  $('#editor-summary').textContent = '+ Add Chore';
  $('#edit-note').hidden = true;
  $('#chore-editor').open = false;
  $('#editor-summary').focus();
}
$('#household-form').addEventListener('submit', (event) => {
  event.preventDefault();
  update((state) => domain.renameHousehold(state, event.target.elements.name.value), 'Household name saved.');
});
$('#member-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = event.target.elements.name;
  if (update((state) => domain.addMember(state, input.value), 'Member added.')) { input.value = ''; input.focus(); }
});
choreForm.elements.frequency.addEventListener('change', scheduleFields);
choreForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(choreForm));
  if (update((state) => domain.saveChore(state, values, editingId), editingId ? 'Chore updated.' : 'Chore added.')) closeEditor();
});
$('#cancel-edit').addEventListener('click', closeEditor);
$('#member-filter').addEventListener('change', render);
$('#dismiss-suggestions').addEventListener('click', () => {
  if (update((state) => { state.dismissedSuggestions = true; }, 'Suggestions dismissed.')) $('#chores-heading').focus();
});
function choosePerson(action, chore) {
  const members = store.getState().household.members;
  if (action === 'complete' && !members.length) {
    say('Add a household member before recording who completed this chore.', true);
    return;
  }
  personAction = { action, id: chore.id };
  $('#person-title').textContent = action === 'complete' ? `Who completed ${chore.name}?` : `Reassign ${chore.name}`;
  $('#person-help').textContent = action === 'complete' ? 'This name will be recorded in completion history.' : 'Only this occurrence changes. Future rotation stays the same.';
  options($('#person-select'), members, action === 'complete' ? null : 'Unassigned', chore.assignedMemberId || '');
  $('#person-error').hidden = true;
  dialog.showModal();
}
$('#cancel-person').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  if (!personAction) return;
  const prefix = personAction.action === 'complete' ? 'done' : 'options';
  const trigger = document.getElementById(`${prefix}-${personAction.id}`);
  if (trigger && !trigger.disabled) trigger.focus();
  else $('#chores-heading').focus();
});
$('#person-form').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    store.update((state) => {
      domain.reconcile(state);
      if (personAction.action === 'complete') domain.completeChore(state, personAction.id, $('#person-select').value);
      else domain.reassignChore(state, personAction.id, $('#person-select').value);
    });
    dialog.close();
    render();
    say(personAction.action === 'complete' ? 'Chore completed.' : 'Chore reassigned.');
    $('#chores-heading').focus();
  } catch (error) {
    $('#person-error').textContent = error.message;
    $('#person-error').hidden = false;
  }
});

document.addEventListener('click', (event) => {
  const target = event.target.closest('button[data-action]');
  if (!target) return;
  const { action, id } = target.dataset;
  const menu = target.closest('.row-menu');
  if (menu) menu.open = false;
  if (action === 'up' || action === 'down') {
    update((state) => domain.moveMember(state, id, action === 'up' ? -1 : 1), 'Rotation order updated.');
    return;
  }
  if (action === 'remove') {
    if (update((state) => domain.removeMember(state, id), 'Member removed.')) $('#member-form').elements.name.focus();
    return;
  }
  const chore = store.getState().chores.find((item) => item.id === id);
  if (!chore) return;
  if (action === 'delete') {
    if (window.confirm(`Delete “${chore.name}”? Completion history will be kept.`)) {
      if (update((state) => domain.deleteChore(state, id), 'Chore deleted.')) {
        if (editingId === id) closeEditor();
        $('#chores-heading').focus();
      }
    }
  } else if (action === 'done') {
    if (chore.assignedMemberId) {
      if (update((state) => domain.completeChore(state, id), 'Chore completed.')) $('#chores-heading').focus();
    }
    else choosePerson('complete', chore);
  } else if (action === 'reassign') choosePerson('reassign', chore);
  else if (action === 'edit') {
    editingId = id;
    for (const key of ['name', 'frequency', 'weekday', 'dayOfMonth', 'assignedMemberId']) choreForm.elements[key].value = chore[key] ?? '';
    scheduleFields();
    $('#editor-summary').textContent = 'Edit chore';
    $('#edit-note').hidden = false;
    $('#chore-editor').open = true;
    choreForm.elements.name.focus();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    for (const menu of document.querySelectorAll('.row-menu[open]')) {
      menu.open = false;
      menu.querySelector('summary').focus();
    }
  }
});
function reconcile() {
  lastDay = domain.localDate();
  if (store.getError()) { render(); return; }
  const state = store.getState();
  const before = JSON.stringify(state);
  domain.reconcile(state, lastDay);
  if (JSON.stringify(state) !== before) update((current) => domain.reconcile(current, lastDay), 'Chores updated for today.');
  else render();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) reconcile(); });
window.addEventListener('focus', reconcile);
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) {
    store = createStore();
    if (dialog.open) dialog.close();
    closeEditor();
    reconcile();
    say('Household data refreshed from another tab.');
  }
});
setInterval(() => { if (domain.localDate() !== lastDay) reconcile(); }, 30_000);
scheduleFields();
reconcile();
