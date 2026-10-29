# Em seu_projeto/urls.py ou no urls.py da sua app de autenticação
from django.urls import path
from .views import CookieLoginView, CookieTokenRefreshView, LogoutView, ProtectedView

urlpatterns = [
    path('api/token/', CookieLoginView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh_cookie'),
    path('api/logout/', LogoutView.as_view(), name='logout'),
    path('protected/', ProtectedView.as_view(), name='protected')
]