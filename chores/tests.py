from django.contrib.staticfiles import finders
from django.contrib.auth.models import User
from django.test import SimpleTestCase, TestCase
from django.urls import reverse


class DashboardTests(TestCase):
    def test_dashboard_requires_login(self):
        response = self.client.get(reverse('chores:dashboard'))
        self.assertRedirects(response, f'{reverse("chores:login")}?next={reverse("chores:dashboard")}')

    def test_dashboard_renders_for_authenticated_account(self):
        user = User.objects.create_user(username='dashboard', password='A-secure-password-123')
        self.client.force_login(user)
        response = self.client.get(reverse('chores:dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'chores/dashboard.html')
        for text in ['Household members', 'Completion history', 'No chores yet']:
            self.assertContains(response, text)

    def test_dashboard_assets_are_discoverable(self):
        for asset in ['dashboard.css', 'dashboard.js', 'state.mjs', 'domain.mjs']:
            self.assertIsNotNone(finders.find(f'chores/{asset}'))


class AccountTests(TestCase):
    def test_signup_creates_account_household_and_logs_in(self):
        response = self.client.post(reverse('chores:signup'), {
            'username': 'shared-home',
            'password1': 'A-secure-password-123',
            'password2': 'A-secure-password-123',
        })
        self.assertRedirects(response, reverse('chores:dashboard'))
        user = User.objects.get(username='shared-home')
        self.assertTrue(user.is_authenticated)
        self.assertEqual(user.household.state['chores'], [])

    def test_login_and_logout_use_the_same_account(self):
        user = User.objects.create_user(username='roommates', password='A-secure-password-123')
        response = self.client.post(reverse('chores:login'), {
            'username': 'roommates', 'password': 'A-secure-password-123',
        })
        self.assertRedirects(response, reverse('chores:dashboard'))
        self.assertContains(self.client.get(reverse('chores:dashboard')), 'Sign out')
        self.assertRedirects(self.client.post(reverse('logout')), reverse('chores:login'))
        self.assertContains(self.client.get(reverse('chores:login')), 'Sign in')

    def test_authenticated_household_state_is_shared_through_api(self):
        user = User.objects.create_user(username='household', password='A-secure-password-123')
        self.client.force_login(user)
        state = {'version': 1, 'household': {'name': 'Shared home', 'members': []},
                 'chores': [], 'history': [], 'dismissedSuggestions': False}
        response = self.client.put(reverse('chores:household_state'), data=state, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.client.logout()
        second_client = self.client_class()
        second_client.force_login(user)
        response = second_client.get(reverse('chores:household_state'))
        self.assertEqual(response.json()['household']['name'], 'Shared home')

    def test_state_endpoint_requires_login_and_rejects_invalid_payload(self):
        self.assertEqual(self.client.get(reverse('chores:household_state')).status_code, 302)
        user = User.objects.create_user(username='safe', password='A-secure-password-123')
        self.client.force_login(user)
        response = self.client.put(reverse('chores:household_state'), data={'version': 1}, content_type='application/json')
        self.assertEqual(response.status_code, 400)
