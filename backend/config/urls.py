from django.urls import path
from game import views

urlpatterns = [
    path("api/session", views.session),
    path("api/auth/<str:action>", views.account),
    path("api/dashboard", views.dashboard),
    path("api/challenges", views.create),
    path("api/challenges/<uuid:pk>", views.host),
    path("api/invites/<uuid:pk>", views.invite),
    path("api/invites/<uuid:pk>/<str:action>", views.move),
]
