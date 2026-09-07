# share-the-load
A tool for managing shared household chores

Built with Django. The project configuration is in `share_the_load/` and the
household chores app is in `chores/`.

## Local development

With Python 3.12 or later and uv installed:

```bash
uv sync --locked
uv run python manage.py runserver
```

Open http://127.0.0.1:8000/ to view the household dashboard.
The generated settings are for local development.

Dependencies are declared in `pyproject.toml` and pinned in `uv.lock`. uv manages
the `.venv` environment automatically. Add dependencies with `uv add <package>`.
The dashboard needs no database migrations; if using Django's admin, first run
`uv run python manage.py migrate`.

Django serves the page and static assets. Household state is stored under the
versioned `share-the-load.state` localStorage key in your browser, not in Django's
database. It persists in the same browser and origin, but does not sync across
devices. Clearing browser data removes it.

Name your household, add members in rotation order, then use **+ Add Chore** to
create daily, weekly, or monthly chores. Use the row menu to edit, reassign, or
delete a chore. **Done** records a completion; **View history** shows the most
recent 20. Reassign a member's chores before removing them.

## Scheduling rules

- Dates use the browser's local calendar. Monthly dates such as the 31st fall on
  the month's last day when needed.
- The first due date is today or the next date matching the recurrence. Completed
  chores stay visible until the next recurrence, when the next member takes over.
- A completed row previews the next rotation member alongside its next date. The
  stored current occurrence and history still retain the person who did the chore;
  the assignment changes when that next occurrence begins.
- Overdue chores keep their current occurrence and assignee. Completing overdue
  work schedules the next future recurrence; missed occurrences do not accumulate.
- Initially unassigned chores get the first member at their next recurrence.
  With no members, they stay unassigned until a recurrence with members available.
- Manual reassignment affects the current occurrence only. Rotation follows the
  last automatically assigned member in the household's current order. Removing
  that member preserves their successor's next turn.
- Completion is credited to the assignee. For unassigned chores, choose a member.
  History keeps snapshot names even after edits and deletions.
- Editing a recurrence starts a fresh occurrence under the new schedule. Changing
  only the name or assignee preserves completion and the rotation position.
- Scheduling reconciles on load, return to the tab, and a date change while open.
  Returning after several days leaves one pending occurrence, which can be overdue.

Unreadable or unsupported saved data is preserved and saving is disabled with a
visible error. Storage access or write failures also display an error. Reload after
resolving storage issues. Other tabs refresh when saved state changes; unsaved chore
edits are closed to avoid editing an outdated occurrence.

## Tests

Run the Django route and static asset tests:

```bash
uv run python manage.py test
```

Run the scheduling, rotation, validation, history, and storage unit tests with
Node.js 22 or later (no npm dependencies required):

```bash
node --test chores/js_tests/*.test.mjs
TZ=America/New_York node --test chores/js_tests/*.test.mjs
```

Install the browser test tools once, then run the browser suite:

```bash
npm ci
npx playwright install --with-deps chromium
npm run test:browser
```

The browser suite starts and stops its own Django server on `127.0.0.1:8001`;
leave that port free. It uses isolated browser contexts, so your household at
port 8000 is unaffected. Python dependencies must already be installed with
`uv sync --locked`. Browser tooling is only needed for development and tests.

Browser tests cover setup, CRUD and cancellation, assignment, history limits,
sorting/filtering, midnight and daylight-saving transitions, storage failures,
two-tab updates, keyboard focus, and mobile/tablet/desktop layouts. Failures save
screenshots and traces under the ignored `test-results/` directory.

`uv run python manage.py test` runs only Django's Python tests. Run both the Node
unit tests and browser suite to verify the browser-side application behavior too.
