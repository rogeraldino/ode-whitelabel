from django.urls import path
from llm import views

urlpatterns = [
    path("gerar-mais-questoes/", views.gerar_mais_questoes),
    path("simplificar-questao/", views.simplificar_questao),
    path("dificultar-questao/", views.dificultar_questao),
    path("contextualizar-questao/", views.contextualizar_questao),
    path("resultado-task/<str:task_id>/", views.resultado_task),  # NOVA

]
