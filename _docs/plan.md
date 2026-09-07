# Shared Household Chores Tool — v1 Scope

## 1. Goal

Build a simple responsive web tool for managing recurring household chores in any shared household.

The tool should help a household:

- create recurring chores,
- assign chores to members,
- rotate chores automatically,
- track completion and overdue chores,
- reassign chores when needed,
- view a small completion history.

The first version should stay simple and avoid accounts, authentication, notifications, advanced fairness scoring, and backend infrastructure.

---

## 2. Target Users

The tool is designed for **any shared household**, including:

- roommates,
- couples,
- families,
- other people sharing household responsibilities.

---

## 3. Household Model

v1 supports **one household only**.

The household has:

- an editable household name,
- a list of household members,
- a fixed rotation order for those members.

Members are represented by **names only**.

There are:

- no individual accounts,
- no login,
- no authentication,
- no profile switching.

Household members can be:

- added,
- removed,
- reordered.

If a member is removed while chores are assigned to them, the user must manually reassign those chores before removal is completed.

---

## 4. Chores

v1 supports **recurring chores only**.

Supported frequencies:

- Daily
- Weekly
- Monthly

### Scheduling rules

#### Daily
A daily chore resets every new day.

No time-of-day scheduling is needed.

#### Weekly
The user selects the weekday.

Example:

- Vacuum — every Saturday

#### Monthly
The user selects the day of the month.

Example:

- Clean fridge — every 1st of the month

Users cannot manually change the next due date independently of the recurrence rule.

---

## 5. Creating a Chore

The dashboard contains a collapsed **+ Add Chore** form.

The form opens when clicked.

### Required fields

- Chore name
- Frequency

### Optional field

- Assigned person

No description or notes field is needed in v1.

If the chore is created without an assigned person, it remains unassigned until its next occurrence begins. At that point, the system automatically assigns it according to the household rotation order.

---

## 6. Chore Assignment and Rotation

The household has a fixed member rotation.

Example:

> Alex → Sam → Jamie → Alex

The household can reorder this sequence.

Automatic rotation determines who receives the next occurrence of a chore.

### Manual reassignment

Users may manually reassign the current occurrence of a chore.

Manual reassignment:

- affects only the current occurrence,
- does not change the future rotation sequence.

Skipping chores is not supported in v1.

---

## 7. Completing Chores

Each chore row has a visible **Done** action.

When a user marks a chore as done:

- the current occurrence is marked completed,
- the completion is added to history,
- the chore remains visible until its next scheduled recurrence,
- the next recurrence is generated according to its normal schedule.

Rotation happens when the next scheduled occurrence begins, not immediately when the current one is completed.

---

## 8. Overdue Chores

If a chore is not completed by its due date:

- it becomes overdue,
- it remains assigned to the same person,
- it is not automatically reassigned.

There are no reminder notifications in v1.

Overdue chores are highlighted directly on the dashboard.

---

## 9. Dashboard

The dashboard is the main and only major working screen.

It should include:

- today's chores,
- upcoming chores,
- chores grouped or filterable by person,
- household members,
- household name,
- rotation order,
- add chore controls,
- history access.

The interface should use a **compact list**, not large cards.

### Chore row

Each chore row should show:

- chore name,
- assigned person's name,
- frequency,
- next scheduled date,
- status indicator,
- Done button,
- three-dot menu.

### Three-dot menu

Contains:

- Reassign
- Edit
- Delete

No separate chore detail page is needed.

---

## 10. Status Design

Statuses should be easy to scan visually.

Use:

- color,
- icon,
- small text label.

Suggested states:

- ○ To Do
- ✓ Done
- ! Overdue

The interface should not rely on color alone.

---

## 11. Sorting and Filtering

Chores are sorted primarily by **next due date**.

If multiple chores have the same date, no special secondary sorting rule is required.

Users can filter chores by **household member**.

No other filters are required in v1.

---

## 12. Editing and Deleting

Users can:

- edit chores,
- delete chores,
- manually reassign chores.

Editing should reuse the same fields as chore creation.

No advanced confirmation workflow is required beyond a simple confirmation before destructive deletion.

---

## 13. Completion History

A **View History** button reveals completion history.

History is read-only.

Keep only the **20 most recent completions**.

Each history entry contains:

- chore name,
- person who completed it,
- completion date.

Users cannot manually clear history in v1.

---

## 14. Empty State

When the household has no chores yet, show dismissible example suggestions such as:

- Dishes
- Trash
- Vacuuming

These are suggestions only.

They are not automatically added.

The suggestions disappear once users begin creating their own chores or dismiss them.

---

## 15. Persistence

Use **browser localStorage**.

Data should survive:

- page refreshes,
- closing and reopening the browser.

No backend or database is required for v1.

Suggested stored data:

- household name,
- household members,
- rotation order,
- chores,
- current assignments,
- completion state,
- recent history.

---

## 16. Platform

Build the tool as a **responsive web application**.

It should work reasonably well on:

- desktop,
- tablet,
- mobile.

Desktop can be the primary design target, but the layout should adapt to smaller screens.

---

## 17. Explicitly Out of Scope for v1

To keep the homework manageable, do **not** include:

- user accounts,
- authentication,
- multiple households,
- backend/database,
- cloud synchronization,
- notifications,
- email reminders,
- push notifications,
- chore skipping,
- one-time chores,
- custom recurrence intervals,
- time-of-day scheduling,
- manual due-date overrides,
- effort-based fairness,
- points,
- workload scoring,
- estimated chore duration,
- statistics or analytics,
- calendars,
- comments,
- attachments,
- profiles or avatars,
- permissions or admin roles,
- history deletion,
- advanced search,
- drag-and-drop chore ordering.

---

## 18. Recommended Core Data Model

### Household

```text
Household
- name
- members[]
```

### Member

```text
Member
- id
- name
- rotationPosition
```

### Chore

```text
Chore
- id
- name
- frequency
- weekday        // weekly only
- dayOfMonth     // monthly only
- assignedMemberId
- rotationIndex
- nextDueDate
- completed
- completedAt
```

### History Entry

```text
HistoryEntry
- id
- choreName
- memberName
- completedAt
```

---

## 19. Main User Flow

### Initial setup

1. Enter household name.
2. Add household members.
3. Arrange member rotation order.
4. Create the first chore.

### Normal use

1. Open dashboard.
2. See chores ordered by due date.
3. Filter by person if needed.
4. Complete a chore with **Done**.
5. Reassign, edit, or delete through the three-dot menu.
6. At the next recurrence, the chore resets and rotation determines the next assignee.
7. Open **View History** to see recent completions.

---

## 20. Definition of Done for the Homework

The project can be considered complete when a user can:

- create and rename a household,
- add, remove, and reorder members,
- create daily, weekly, and monthly chores,
- optionally assign a chore,
- automatically rotate assignments,
- mark chores done,
- see overdue chores,
- manually reassign chores,
- edit and delete chores,
- filter chores by member,
- see the next scheduled date,
- view the last 20 completions,
- refresh the browser without losing data,
- use the interface on both desktop and mobile.

Anything beyond these requirements should be treated as a future enhancement rather than part of the homework.
