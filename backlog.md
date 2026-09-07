# Django v1 backlog

Based on `_docs/plan.md`, ordered for implementation.

Status: tasks 1–6 implemented. Django checks and route tests, 20 JavaScript
domain/storage tests, and Chromium workflow checks pass. Desktop and mobile
screenshots reviewed. See `README.md` for startup and the implemented rules.

## Scope

Use the existing Django project and `chores` app to serve templates and static
CSS/JavaScript. Preserve the plan's localStorage persistence: household data stays
in the browser, with no application database models, API, accounts, or background
workers. Data is specific to the browser and is not synchronized between devices.
The existing Django scaffold does not require using its database for this tool.

## 1. Build the dashboard shell and browser persistence foundation — complete

Wire the root URL to a `chores` view and create a responsive Django template with
static CSS and JavaScript. Add a versioned localStorage state module for household,
members, chores, completion history, and dismissed suggestions.

Acceptance criteria:
- `/` renders the dashboard with household, chore list, and history placeholders.
- A first visit initializes an empty household without creating example chores.
- State changes survive refreshes and reopening the browser.
- Missing, invalid, or unavailable localStorage produces a usable empty state or
  clear error without silently overwriting existing data.

## 2. Implement household setup and member rotation order — complete

Add household naming and renaming, member creation, removal, and move-up/move-down
controls for the fixed rotation order. Give members stable IDs.

Acceptance criteria:
- Names and rotation order persist and appear on the dashboard.
- Blank names are rejected.
- Removing an assigned member requires manually reassigning their chores first.
- An empty member list is supported; chores remain unassigned until members exist.

## 3. Add recurring chore creation, editing, and deletion — complete

Build the collapsed **+ Add Chore** form and reuse its fields for editing. Support
daily, weekly (weekday), and monthly (day of month) schedules and optional assignees.
Add the row menu with Edit and Delete, including simple deletion confirmation.

Acceptance criteria:
- Name and frequency are required; recurrence-specific fields are validated.
- Dates derive from recurrence rules, with no manual due-date override.
- Newly created unassigned chores remain unassigned for their first occurrence.
- Dishes, Trash, and Vacuuming suggestions are dismissible and disappear when a
  chore is created; suggestions never create chores automatically.

## 4. Implement recurrence, overdue state, and automatic rotation — complete

Create browser-side scheduling functions and reconcile state on page load, return
to the tab, and a local date change while the page is open. Keep the rotation cursor
separate from the current assignee so manual reassignment does not affect rotation.

Acceptance criteria:
- Daily, weekly, and monthly occurrences follow calendar dates rather than elapsed
  24-hour intervals.
- Completed chores reset and rotate only when the next scheduled occurrence begins.
- Incomplete overdue occurrences retain their assignee and are not overwritten.
- Initially unassigned chores receive an assignee at the next occurrence when a
  member is available.
- Reconciliation is repeatable without duplicate occurrences or extra rotations.
- Test date boundaries, missed days, empty/reordered member lists, and reassignment.

Implemented defaults: monthly dates missing from a month use the month's last day;
an initially unassigned chore starts with the first member; overdue completion
resumes at the next future scheduled date without a backlog of missed occurrences.
An assigned chore starts its rotation from that assignee. Member array order defines
the rotation, with stable member IDs anchoring each chore independently.

## 5. Add completion, reassignment, and recent history — complete

Implement **Done**, the Reassign menu action, and a read-only **View History** panel.
Store snapshot names so later edits or member removal do not rewrite history.

Acceptance criteria:
- Done records one completion and keeps the completed row visible until recurrence.
- Manual reassignment changes only the current occurrence.
- History shows chore name, completing person's name, and completion date, newest
  first, retaining only the latest 20 entries with no manual clearing control.
- Repeated Done actions cannot duplicate history entries.

Implemented attribution: use the current assignee, asking for a household member
when completing an unassigned chore. A household with no members must add one first.

## 6. Finish the responsive dashboard and verify the v1 flow — complete

Render compact chore rows sorted by due date, with today's and upcoming work,
overdue visibility, member filtering, frequency, next scheduled date, Done, and
the three-dot menu. Display To Do, Done, and Overdue using text and icons plus color.

Acceptance criteria:
- All household and chore actions work from the dashboard without a detail page.
- Controls work by keyboard and are usable on desktop, tablet, and mobile.
- Verify setup, recurrence, reassignment, member removal, history truncation, and
  persistence through refresh in a browser.
- Run Django system checks and focused automated tests for scheduling and state
  transitions; document local startup and the browser-only storage limitation.
- Keep authentication, notifications, synchronization, and all other excluded
  features outside this backlog.
