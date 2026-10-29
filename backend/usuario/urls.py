# education-backend/api/urls.py
from django.urls import path
from .views import (
    UsuarioLogadoView, 
    AtualizarCredenciaisView, 
    WebhookDoppusView, 
    CriarUsuarioManualView, 
    WebhookGuruView,
    WebhookLastlinkView,
    # Views de administração
    ListarUsuariosView,
    DetalharUsuarioView,
    CriarUsuarioView,
    AtualizarUsuarioView,
    ExcluirUsuarioView,
    GerenciarComponentesUsuarioView,
    RedefinirSenhaUsuarioView,
    AdicionarMesesAcessoView,
    ListarPerfisView,
    ListarComponentesView,
)

urlpatterns = [
    # Rotas públicas
    path("webhook/doppus/criar-usuario/", WebhookDoppusView.as_view(), name="webhook_doppus_criar_usuario"),
    path("webhook/guru/venda/", WebhookGuruView.as_view(), name="webhook_guru_venda"),
    path("webhook/lastlink/venda/", WebhookLastlinkView.as_view(), name="webhook_lastlink_venda"),
    
    # Rotas autenticadas
    path('me/', UsuarioLogadoView.as_view(), name='usuario-logado'),
    path('atualizar-credenciais/', AtualizarCredenciaisView.as_view()),
    path('criar-manual/', CriarUsuarioManualView.as_view(), name='criar-usuario-manual'),
    
    # Rotas de administração
    path('admin/usuarios/', ListarUsuariosView.as_view(), name='admin-listar-usuarios'),
    path('admin/usuarios/<int:usuario_id>/', DetalharUsuarioView.as_view(), name='admin-detalhar-usuario'),
    path('admin/usuarios/criar/', CriarUsuarioView.as_view(), name='admin-criar-usuario'),
    path('admin/usuarios/<int:usuario_id>/editar/', AtualizarUsuarioView.as_view(), name='admin-atualizar-usuario'),
    path('admin/usuarios/<int:usuario_id>/excluir/', ExcluirUsuarioView.as_view(), name='admin-excluir-usuario'),
    path('admin/usuarios/<int:usuario_id>/componentes/', GerenciarComponentesUsuarioView.as_view(), name='admin-gerenciar-componentes'),
    path('admin/usuarios/<int:usuario_id>/redefinir-senha/', RedefinirSenhaUsuarioView.as_view(), name='admin-redefinir-senha'),
    path('admin/usuarios/<int:usuario_id>/adicionar-meses/', AdicionarMesesAcessoView.as_view(), name='admin-adicionar-meses'),
    path('admin/perfis/', ListarPerfisView.as_view(), name='admin-listar-perfis'),
    path('admin/componentes/', ListarComponentesView.as_view(), name='admin-listar-componentes'),
]