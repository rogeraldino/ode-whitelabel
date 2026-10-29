from django.urls import path
from . import views

urlpatterns = [
    path('criar/', views.criar_resumo, name='criar_resumo'),
    path('meus/', views.meus_resumos, name='meus_resumos'),
    path('arquivar/<uuid:resumo_uuid>/', views.arquivar_resumo, name='arquivar_resumo'),
    path('desarquivar/<uuid:resumo_uuid>/', views.desarquivar_resumo, name='desarquivar_resumo'),
    path('deletar/<uuid:resumo_uuid>/', views.deletar_resumo, name='deletar_resumo'),
    path('baixar/<uuid:resumo_uuid>/', views.baixar_resumo, name='baixar_resumo'),
]
