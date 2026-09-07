from django.contrib.staticfiles import finders
from django.test import SimpleTestCase
from django.urls import reverse


class DashboardTests(SimpleTestCase):
    def test_dashboard_renders_without_database_access(self):
        response = self.client.get(reverse('chores:dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'chores/dashboard.html')
        for text in ['Household members', 'Completion history', 'No chores yet']:
            self.assertContains(response, text)

    def test_dashboard_assets_are_discoverable(self):
        for asset in ['dashboard.css', 'dashboard.js', 'state.mjs', 'domain.mjs']:
            self.assertIsNotNone(finders.find(f'chores/{asset}'))
