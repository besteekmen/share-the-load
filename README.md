# share-the-load
A tool for managing shared household chores

Built with Django. The project configuration is in `share_the_load/` and the
household chores app is in `chores/`.

## Local development

With Python 3.12 or later and uv installed:

```bash
uv venv .venv
uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver
```

Open http://127.0.0.1:8000/ to view the Django welcome page.
The generated settings are for local development.

Run Django's system checks:

```bash
.venv/bin/python manage.py check
```
