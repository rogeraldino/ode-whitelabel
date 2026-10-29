# seu_projeto/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static


urlpatterns = [
    path('admin/', admin.site.urls),
    path('atividades/', include('atividades.urls')),
    path('auth/', include('autenticacao.urls')),
    path('conteudo/', include('conteudo.urls')),# Inclua as URLs do seu app de autenticação
    path('docxgenerator/', include('docxgenerator.urls')),
    path('planos/', include('planos.urls')),
    path('resumos/', include('resumos.urls')),
    path('usuario/', include('usuario.urls')),
    path('pdfgenerator/', include('pdfgenerator.urls')),
    path('mapas_mentais/', include('mapas_mentais.urls')),
    path('llm/', include('llm.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)