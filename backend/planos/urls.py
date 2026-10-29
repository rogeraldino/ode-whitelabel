from django.urls import path
from . import views

urlpatterns = [
    path('criar/', views.criar_plano, name='criar_plano'),
    path('meus/', views.meus_planos, name='meus_planos'),
    path('arquivar/<uuid:plano_uuid>/', views.arquivar_plano, name='arquivar_plano'),
    path('desarquivar/<uuid:plano_uuid>/', views.desarquivar_plano, name='desarquivar_plano'),
    path('deletar/<uuid:plano_uuid>/', views.deletar_plano, name='deletar_plano'),
    path('baixar/<uuid:plano_uuid>/', views.baixar_plano, name='baixar_plano'),
]
