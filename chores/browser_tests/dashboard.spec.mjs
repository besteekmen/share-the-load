import { test, expect } from '@playwright/test';

const runtimeErrors = new WeakMap();
const row = (page, name) => page.locator('.chore-row').filter({ has: page.getByRole('heading', { name, exact: true }) });
const saved = (page) => page.evaluate(async () => (await fetch('/state/')).json());
async function members(page, names = ['Alex', 'Sam', 'Jamie']) {
  for (const name of names) {
    await page.getByLabel('New member').fill(name);
    await page.getByRole('button', { name: 'Add member', exact: true }).click();
  }
}
async function add(page, name, frequency = 'daily', assigned = 'Alex') {
  await page.locator('#editor-summary').click();
  await page.getByLabel('Chore name', { exact: true }).fill(name);
  await page.locator('[name=frequency]').selectOption(frequency);
  if (frequency === 'weekly') await page.locator('[name=weekday]').selectOption('6');
  if (frequency === 'monthly') await page.locator('[name=dayOfMonth]').fill('31');
  await page.getByLabel('Assigned person').selectOption({ label: assigned });
  await page.getByRole('button', { name: 'Save chore', exact: true }).click();
  await expect(row(page, name)).toBeVisible();
  await expect(page.locator('#suggestions')).toBeHidden();
}
async function menu(page, name, action) {
  await row(page, name).locator('summary').click();
  await row(page, name).getByRole('button', { name: action, exact: true }).click();
}
async function advance(page, date) {
  await page.clock.setSystemTime(new Date(date));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
}

test.beforeEach(async ({ page }) => {
  runtimeErrors.set(page, []);
  page.on('pageerror', (error) => runtimeErrors.get(page).push(error.message));
  await page.clock.install({ time: new Date('2026-01-01T17:00:00Z') });
  await page.goto('/signup/');
  const username = `test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.getByLabel('Username').fill(username);
  await page.locator('input[name=password1]').fill('A-secure-password-123');
  await page.locator('input[name=password2]').fill('A-secure-password-123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('#suggestions')).toBeVisible();
});

test('shared account signup and sign-in load the same household on another browser', async ({ page, context }) => {
  const username = `home-${Date.now()}`;
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.goto('/signup/');
  await page.getByLabel('Username').fill(username);
  await page.locator('input[name=password1]').fill('A-secure-password-123');
  await page.locator('input[name=password2]').fill('A-secure-password-123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('.logout-form')).toBeVisible();
  await page.getByLabel('Household name', { exact: true }).fill('Shared account home');
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/state/') && response.status() === 200),
    page.getByRole('button', { name: 'Save household name' }).click(),
  ]);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.goto('/login/');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill('A-secure-password-123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#household-name')).toHaveText('Shared account home');
  const otherContext = await context.browser().newContext();
  const other = await otherContext.newPage();
  await other.goto('/login/');
  await other.getByLabel('Username').fill(username);
  await other.getByLabel('Password', { exact: true }).fill('A-secure-password-123');
  await other.getByRole('button', { name: 'Sign in' }).click();
  await expect(other.locator('#household-name')).toHaveText('Shared account home');
  await otherContext.close();
});

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page), 'No uncaught browser errors').toEqual([]);
});

test('household setup, completion attribution and history survive reopening', async ({ page, context }) => {
  await page.getByLabel('Household name', { exact: true }).fill('Maple House');
  await page.getByRole('button', { name: 'Save household name' }).click();
  await members(page);
  await page.getByRole('button', { name: 'Move Jamie up' }).click();
  await expect(page.locator('#member-list li').nth(1)).toContainText('Jamie');
  await add(page, 'Dishes');
  await menu(page, 'Dishes', 'Reassign');
  await page.locator('#person-select').selectOption({ label: 'Sam' });
  await page.locator('#person-form button[type=submit]').click();
  await page.getByRole('button', { name: 'Mark Dishes done' }).click();
  await page.getByText('View history', { exact: true }).click();
  await expect(page.locator('#history-list')).toContainText('Sam');
  await expect(row(page, 'Dishes').locator('.status')).toHaveText('✓ Done');
  await expect(row(page, 'Dishes')).toContainText('Jamie');
  const snapshot = await saved(page);
  await page.reload();
  expect(await saved(page)).toEqual(snapshot);
  const reopened = await context.newPage();
  await reopened.clock.install({ time: new Date('2026-01-01T17:00:00Z') });
  await reopened.goto('/');
  await expect(reopened.locator('#household-name')).toHaveText('Maple House');
  expect(await saved(reopened)).toEqual(snapshot);
});

test('member removal is blocked until assigned and completed chores are reassigned', async ({ page }) => {
  await members(page);
  await add(page, 'Dishes');
  await page.getByRole('button', { name: 'Mark Dishes done' }).click();
  await page.getByRole('button', { name: 'Remove Alex', exact: true }).click();
  await expect(page.locator('#message')).toContainText('Reassign');
  await expect(page.locator('#member-list li')).toHaveCount(3);
  await menu(page, 'Dishes', 'Reassign');
  await page.locator('#person-select').selectOption({ label: 'Sam' });
  await page.locator('#person-form button[type=submit]').click();
  await page.getByRole('button', { name: 'Remove Alex', exact: true }).click();
  await expect(page.locator('#member-list li')).toHaveCount(2);
  expect((await saved(page)).history[0].memberName).toBe('Alex');
});

test('due-date sorting, groups, person filter and empty results', async ({ page }) => {
  await members(page);
  await add(page, 'Monthly', 'monthly');
  await add(page, 'Weekly', 'weekly');
  await add(page, 'Overdue');
  await advance(page, '2026-01-02T17:00:00Z');
  await add(page, 'Today', 'daily', 'Sam');
  await expect(page.locator('.chore-row h4')).toHaveText(['Overdue', 'Today', 'Weekly', 'Monthly']);
  await expect(page.locator('.list-heading')).toHaveText(['Past due', 'Today', 'Upcoming']);
  await expect(row(page, 'Overdue').locator('.status')).toHaveText('! Overdue');
  await page.getByLabel('Filter by person').selectOption({ label: 'Sam' });
  await expect(page.locator('.chore-row h4')).toHaveText(['Today']);
  await page.getByLabel('Filter by person').selectOption({ label: 'Jamie' });
  await expect(page.getByText('No chores for this person')).toBeVisible();
  await page.getByLabel('Filter by person').selectOption({ label: 'All members' });
  await expect(page.locator('.chore-row')).toHaveCount(4);
});

test('suggestion dismissal persists and deletion does not restore suggestions', async ({ page }) => {
  await page.getByRole('button', { name: 'Dismiss suggestions' }).click();
  await page.reload();
  await expect(page.locator('#suggestions')).toBeHidden();
  await members(page);
  await add(page, 'Dishes');
  page.once('dialog', (dialog) => dialog.accept());
  await menu(page, 'Dishes', 'Delete');
  await expect(page.getByText('No chores yet', { exact: true })).toBeVisible();
  await expect(page.locator('#suggestions')).toBeHidden();
});

test('edit cancellation, recurrence edits, deletion confirmation and history retention', async ({ page }) => {
  await members(page);
  await add(page, 'Dishes');
  await page.getByRole('button', { name: 'Mark Dishes done' }).click();
  const before = await saved(page);
  await menu(page, 'Dishes', 'Edit');
  await page.getByLabel('Chore name', { exact: true }).fill('Unsaved');
  await page.locator('#cancel-edit').click();
  expect(await saved(page)).toEqual(before);
  for (const frequency of ['weekly', 'monthly', 'daily']) {
    await menu(page, 'Dishes', 'Edit');
    await page.locator('[name=frequency]').selectOption(frequency);
    if (frequency === 'weekly') await page.locator('[name=weekday]').selectOption('6');
    if (frequency === 'monthly') await page.locator('[name=dayOfMonth]').fill('31');
    await page.getByRole('button', { name: 'Save chore', exact: true }).click();
    expect((await saved(page)).chores[0].frequency).toBe(frequency);
    await expect(row(page, 'Dishes').locator('.status')).toHaveText('○ To Do');
  }
  page.once('dialog', (dialog) => dialog.dismiss());
  await menu(page, 'Dishes', 'Delete');
  await expect(row(page, 'Dishes')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await menu(page, 'Dishes', 'Delete');
  await expect(row(page, 'Dishes')).toHaveCount(0);
  expect((await saved(page)).history).toEqual(before.history);
});

test('double Done dispatch records once; unassigned picker cancellation changes nothing', async ({ page }) => {
  await members(page);
  await add(page, 'Dishes');
  await row(page, 'Dishes').locator('[data-action=done]').evaluate((button) => {
    button.click(); button.click();
  });
  expect((await saved(page)).history).toHaveLength(1);
  await add(page, 'Trash', 'daily', 'Unassigned');
  const before = await saved(page);
  await page.getByRole('button', { name: 'Mark Trash done' }).click();
  await page.locator('#cancel-person').click();
  await expect(page.getByRole('button', { name: 'Mark Trash done' })).toBeFocused();
  expect(await saved(page)).toEqual(before);
  await page.getByRole('button', { name: 'Mark Trash done' }).click();
  await page.locator('#person-select').selectOption({ label: 'Jamie' });
  await page.locator('#person-form button[type=submit]').click();
  const state = await saved(page);
  expect(state.history.map((item) => item.memberName)).toEqual(['Jamie', 'Alex']);
});

test('unassigned completion without members displays an actionable error', async ({ page }) => {
  await add(page, 'Trash', 'daily', 'Unassigned');
  await page.getByRole('button', { name: 'Mark Trash done' }).click();
  await expect(page.locator('#message')).toContainText('Add a household member');
  expect((await saved(page)).history).toHaveLength(0);
});

test('midnight timer rotates once and later visibility reconciliation retains overdue work', async ({ page }) => {
  await members(page);
  await add(page, 'Dishes');
  await page.getByRole('button', { name: 'Mark Dishes done' }).click();
  await page.clock.setSystemTime(new Date('2026-01-02T04:59:50Z'));
  await page.clock.runFor(40_000);
  await expect(row(page, 'Dishes')).toContainText('Sam');
  await expect(row(page, 'Dishes').locator('.status')).toHaveText('○ To Do');
  await page.clock.setSystemTime(new Date('2026-01-10T17:00:00Z'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(row(page, 'Dishes').locator('.status')).toHaveText('! Overdue');
  await expect(row(page, 'Dishes')).toContainText('Sam');
  await page.getByRole('button', { name: 'Mark Dishes done' }).click();
  expect((await saved(page)).chores[0].nextOccurrenceDate).toBe('2026-01-11');
});

for (const [label, before, after] of [
  ['spring', '2026-03-08T06:59:50Z', '2026-03-09T04:00:01Z'],
  ['autumn', '2026-11-01T05:59:50Z', '2026-11-02T05:00:01Z'],
]) {
  test(`${label} daylight-saving change does not cause an extra daily rotation`, async ({ page }) => {
    await advance(page, before);
    await members(page);
    await add(page, 'Dishes');
    await page.getByRole('button', { name: 'Mark Dishes done' }).click();
    await page.clock.runFor(30_000);
    await expect(row(page, 'Dishes').locator('.status')).toHaveText('✓ Done');
    await advance(page, after);
    await expect(row(page, 'Dishes')).toContainText('Sam');
    await expect(row(page, 'Dishes').locator('.status')).toHaveText('○ To Do');
  });
}

test('history renders the newest 20 completions after refresh', async ({ page }) => {
  await members(page);
  await add(page, 'Dishes');
  for (let day = 1; day <= 22; day++) {
    await advance(page, `2026-01-${String(day).padStart(2, '0')}T17:00:00Z`);
    await page.getByRole('button', { name: 'Mark Dishes done' }).click();
  }
  await page.reload();
  await page.getByText('View history', { exact: true }).click();
  await expect(page.locator('#history-list li')).toHaveCount(20);
  await expect(page.locator('#history-list li').first()).toContainText('1/22/2026');
  await expect(page.locator('#history-list li').last()).toContainText('1/3/2026');
});

test('database persistence survives reload and a second session', async ({ page, context }) => {
  await members(page);
  await add(page, 'Dishes');
  const other = await context.newPage();
  await other.clock.install({ time: new Date('2026-01-01T17:00:00Z') });
  await other.goto('/');
  await expect(row(other, 'Dishes')).toBeVisible();
  await page.reload();
  await expect(row(page, 'Dishes')).toBeVisible();
  expect((await saved(page)).chores).toHaveLength(1);
});

test('keyboard forms, validation, menu Escape and dialog focus restoration', async ({ page }) => {
  await page.getByLabel('New member').focus();
  await page.keyboard.type('   ');
  await page.keyboard.press('Enter');
  await expect(page.locator('#message')).toContainText('Please enter a name');
  await expect(page.locator('#message')).toBeFocused();
  await page.getByLabel('New member').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Alex');
  await page.keyboard.press('Enter');
  await page.locator('#editor-summary').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Chore name', { exact: true })).toBeFocused();
  await page.keyboard.type('Dishes');
  await page.keyboard.press('Enter');
  await expect(row(page, 'Dishes')).toBeVisible();
  const summary = row(page, 'Dishes').locator('summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(summary).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator('#person-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#person-dialog')).not.toBeVisible();
  await expect(summary).toBeFocused();
});

for (const width of [375, 768, 1280]) {
  test(`forms and dialogs fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await members(page);
    await add(page, 'Long chore '.repeat(8));
    await page.locator('#editor-summary').click();
    await page.locator('[name=frequency]').selectOption('monthly');
    await page.locator('[name=dayOfMonth]').fill('32');
    await page.getByLabel('Chore name', { exact: true }).fill('Invalid');
    await page.getByRole('button', { name: 'Save chore', exact: true }).click();
    expect(await page.locator('[name=dayOfMonth]').evaluate((input) => input.validity.rangeOverflow)).toBe(true);
    await expect(page.locator('.chore-row')).toHaveCount(1);
    await page.locator('#cancel-edit').click();
    await menu(page, 'Long chore '.repeat(8).trim(), 'Reassign');
    await expect(page.locator('#person-dialog')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const box = await page.locator('#person-dialog').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
  });
}
