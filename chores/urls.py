from django.urls import path

from . import views

app_name = 'chores'
urlpatterns = [path('', views.dashboard, name='dashboard')]
urlpatterns += [
    path('login/', views.AccountLoginView.as_view(), name='login'),
    path('signup/', views.signup, name='signup'),
    path('state/', views.household_state, name='household_state'),
]
