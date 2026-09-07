import json

from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from django.contrib.auth.views import LoginView
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_http_methods

from .models import Household, initial_household_state

@login_required
def dashboard(request):
    household, _ = Household.objects.get_or_create(owner=request.user)
    context = {'household_state': household.state, 'account_mode': True}
    return render(request, 'chores/dashboard.html', context)


class AccountLoginView(LoginView):
    template_name = 'registration/login.html'
    authentication_form = AuthenticationForm
    redirect_authenticated_user = True


def signup(request):
    if request.user.is_authenticated:
        return redirect('chores:dashboard')
    form = UserCreationForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        user = form.save()
        Household.objects.create(owner=user, state=initial_household_state())
        login(request, user)
        return redirect('chores:dashboard')
    return render(request, 'registration/signup.html', {'form': form})


@login_required
@require_http_methods(['GET', 'PUT'])
def household_state(request):
    household, _ = Household.objects.get_or_create(owner=request.user)
    if request.method == 'GET':
        return JsonResponse(household.state)
    try:
        state = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'State must be valid JSON.'}, status=400)
    payload_household = state.get('household') if isinstance(state, dict) else None
    if (not isinstance(state, dict) or state.get('version') != 1 or
            not isinstance(payload_household, dict) or not isinstance(payload_household.get('name'), str) or
            not isinstance(payload_household.get('members'), list) or not isinstance(state.get('chores'), list) or
            not isinstance(state.get('history'), list) or len(state['history']) > 20 or
            not isinstance(state.get('dismissedSuggestions'), bool)):
        return JsonResponse({'error': 'Unsupported household state.'}, status=400)
    household.state = state
    household.save(update_fields=['state', 'updated_at'])
    return JsonResponse({'ok': True})
