import os
from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from conteudo.models import Componente
from usuario.models import Perfil, Usuario


class WebhookLastlinkRevogacaoTests(APITestCase):
    def setUp(self):
        os.environ["LASTLINK_WEBHOOK_TOKEN"] = "token_teste_123"

        self.componente = Componente.objects.create(nome="Matemática", slug="matematica")
        self.perfil = Perfil.objects.create(nome="Perfil Teste")
        self.perfil.componentes.add(self.componente)

        self.usuario = Usuario.objects.create_user(
            email="cliente2@email.com",
            usuario=None,
            senha="senha",
            nome="Maria Oliveira",
        )
        self.usuario.perfil = self.perfil
        self.usuario.expira_em = timezone.now() + timedelta(days=30)
        self.usuario.save(update_fields=["perfil", "expira_em"])

    def test_payment_refund_revoga_acesso_e_remove_componente(self):
        payload = {
            "Event": "Payment_Refund",
            "Id": "evt_2a1b3c4d",
            "CreatedAt": "2026-01-10T09:15:33Z",
            "Purchase": {
                "OrderId": "ORD-654321",
                "ProductName": "[MATEMÁTICA] Assistente de Ensino",
                "Customer": {"Email": "cliente2@email.com", "Name": "Maria Oliveira"},
            },
            "Payment": {
                "PaymentId": "pay_123789",
                "PaymentMethod": "pix",
                "Currency": "BRL",
                "Amount": 497.00,
                "RefundedAmount": 497.00,
            },
        }

        before = timezone.now()
        resp = self.client.post(
            "/usuario/webhook/lastlink/venda/",
            data=payload,
            format="json",
            HTTP_X_LASTLINK_TOKEN=os.environ["LASTLINK_WEBHOOK_TOKEN"],
        )
        after = timezone.now()

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data.get("acao"), "revogado")

        self.usuario.refresh_from_db()
        self.assertIsNotNone(self.usuario.expira_em)
        self.assertGreaterEqual(self.usuario.expira_em, before)
        self.assertLessEqual(self.usuario.expira_em, after)

        self.perfil.refresh_from_db()
        self.assertFalse(self.perfil.componentes.filter(id=self.componente.id).exists())
