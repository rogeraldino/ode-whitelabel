from django.urls import path

from .views import (
    listar_componentes_curriculares,
    listar_subcomponentes,
    listar_mapas,
    baixar_mapa_mental,
)

urlpatterns = [
    path('componentes/', listar_componentes_curriculares, name='listar_componentes_curriculares'),
    path('subcomponentes/', listar_subcomponentes, name='listar_subcomponentes'),
    path('mapas/', listar_mapas, name='listar_mapas'),
    path('download/<path:caminho>/', baixar_mapa_mental, name='mapa_mental_download'),
]
