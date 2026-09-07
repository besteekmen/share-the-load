from django.db import models


def initial_household_state():
    return {
        'version': 1,
        'household': {'name': '', 'members': []},
        'chores': [],
        'history': [],
        'dismissedSuggestions': False,
    }


class Household(models.Model):
    owner = models.OneToOneField('auth.User', on_delete=models.CASCADE, related_name='household')
    state = models.JSONField(default=initial_household_state)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.state.get('household', {}).get('name') or f"{self.owner.username}'s household"
