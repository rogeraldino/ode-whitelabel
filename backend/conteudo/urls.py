# education-backend/api/urls.py
from django.urls import path
from . import views
from .views import MapaMentalListView, MapaMentalDownloadView

urlpatterns = [
    path('habilidades/', views.ListarHabilidadesBNCC.as_view(), name='habilidades'),
    path('mapas-mentais/', MapaMentalListView.as_view(), name='mapamental-list'),
    path('mapas-mentais/<int:pk>/download/', MapaMentalDownloadView.as_view(), name='mapamental-download'),
    path('componentes/', views.listar_componentes, name='componentes'),
    path('competencias-gerais/', views.listar_competencias_gerais, name='competencias_gerais'),
    path('competencias-especificas/', views.listar_competencias_especificas, name='competencias_especificas'),
    path('habilidades/<int:habilidade_id>/competencias/', views.competencias_da_habilidade, name='habilidade_competencias'),
    path('metodologias/', views.listar_metodologias, name='metodologias'),
    path('anos-escolares/', views.listar_anos_escolares, name='anos_escolares'),
]
