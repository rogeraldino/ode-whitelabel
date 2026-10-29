import uuid
from io import BytesIO
import logging

from django.http import HttpResponse, JsonResponse
from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from usuario.permissions import perfil_perm
from rest_framework.response import Response
import json

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.styles import getSampleStyleSheet

# Models from other apps
from atividades.models import ListaAtividade, Questao, Alternativa
from .models import ModeloAtividade, ResultadoQuestaoModelo

logger = logging.getLogger(__name__)

# Import the new utility functions and constants, including ApiError
from .utils import _create_models_in_db, draw_gabarito_section, \
    _generate_qr_image_data, ApiError, QR_CODE_SIZE, draw_questions_section, \
    draw_school_header, draw_bncc_header, draw_footer, \
    _calculate_gabarito_qr_layout, draw_gabarito_frame_and_instructions, draw_qrcode_inside_gabarito


def _process_request_data(data):
    """
    Processes the request data, fetches ListaAtividade, and validates questions.
    Returns lista_atividade, questoes_validas, questoes_ids_ordenadas.
    Raises ApiError for validation errors.
    """
    lista_atividade_uuid = data.get('lista_atividade_id')
    questoes_data = data.get('questoes', {})

    # Busca a lista de atividade ou lança erro 404
    try:
        lista_atividade = ListaAtividade.objects.get(uuid=lista_atividade_uuid)
    except ListaAtividade.DoesNotExist:
        raise ApiError("Lista de Atividade não encontrada.", status_code=404)

    questoes_validas = []
    questoes_ids_ordenadas = []

    for questao_uuid, peso in questoes_data.items():
        try:
            questao = Questao.objects.get(uuid=questao_uuid)

            # Valida se a questão pertence à lista via relação ManyToMany
            if not questao.listas.filter(pk=lista_atividade.pk).exists():
                raise ApiError(
                    f"A questão com UUID {questao_uuid} não pertence à Lista de Atividade com UUID {lista_atividade_uuid}.",
                    status_code=400
                )

            questoes_validas.append((questao, peso))
            questoes_ids_ordenadas.append(questao.id)

        except Questao.DoesNotExist:
            raise ApiError(f"Questão com UUID {questao_uuid} não encontrada.", status_code=404)

    return lista_atividade, questoes_validas, questoes_ids_ordenadas

@api_view(['POST'])
@permission_classes([IsAuthenticated, perfil_perm("corrigir-atividade")])
def gerar_correcao_atividade(request):
    try:
        data = json.loads(request.body)

        # 1. Processar e validar dados da requisição (usa sua função existente)
        lista_atividade, questoes_validas, questoes_ids_ordenadas = _process_request_data(data)

        # 2. SALVAR as alterações na lista (sincronizar many-to-many)
        with transaction.atomic():
            # 1) IDs vindos do payload
            payload_uuids = data.get('questoes', {}).keys()
            nova_lista_questoes_ids = set(
                Questao.objects.filter(uuid__in=payload_uuids).values_list('id', flat=True)
            )
            questoes_atuais_ids = set(lista_atividade.questoes.values_list('id', flat=True))

            # 2) Determina o que adicionar e remover
            a_adicionar = nova_lista_questoes_ids - questoes_atuais_ids
            a_remover   = questoes_atuais_ids - nova_lista_questoes_ids

            if a_adicionar:
                lista_atividade.questoes.add(*Questao.objects.filter(id__in=a_adicionar))
            if a_remover:
                lista_atividade.questoes.remove(*Questao.objects.filter(id__in=a_remover))

            # 3) Atualiza o status e a quantidade de questões
            lista_atividade.status = 'salva'
            lista_atividade.quantidade_questoes = lista_atividade.questoes.count()

            # 4) Salva tudo em uma única transação
            lista_atividade.save(update_fields=['status', 'quantidade_questoes'])

        # Create models in the database
        modelo_atividade = _create_models_in_db(
            lista_atividade, questoes_validas, questoes_ids_ordenadas
        )

        # Generate QR Code image data
        qr_image_reportlab = _generate_qr_image_data(modelo_atividade)

        # Setup PDF canvas
        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        p.setFont("Times-Roman", 12)

        # Layout parameters
        margin_x = 20*mm
        right_margin = 10*mm

        page_number = 1

        #
        # CABEÇALHOS & BNCC
        #
        draw_bncc_header(p, width, height, lista_atividade.habilidades.all())
        draw_footer(p, width, height, page_number)
        current_y = draw_school_header(p, width, height, margin_x, right_margin)

        #
        # GABARITO + QR (novo layout)
        #
        layout = _calculate_gabarito_qr_layout(
            width, height, current_y, lista_atividade.quantidade_questoes)

        draw_gabarito_frame_and_instructions(
            p, layout, "Preencha todo o tracejado do retângulo escolhido!", modelo_atividade.identificador_qr
        )
        draw_qrcode_inside_gabarito(p, qr_image_reportlab, layout["qr_x"], layout["qr_y"])
        draw_gabarito_section(
            p, questoes_validas, modelo_atividade, layout,
            layout["box_y"] + layout["box_height"] - 10 * mm - 5 * mm
        )

        # Update Y for subsequent questions
        start_questions_y = layout["box_y"] - 5*mm

        def my_header(p, page_number):
            draw_bncc_header(p, width, height, lista_atividade.habilidades.all())
            draw_footer(p, width, height, page_number)

        p, page_number = draw_questions_section(
            p, questoes_validas, start_questions_y, margin_x, width, height,
            header_func=my_header,
            page_number=page_number
        )

        p.save()
        buffer.seek(0)
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{lista_atividade.nome}.pdf"'
        logger.success(
            "Correção de atividade gerada para lista %s pelo usuario %s",
            lista_atividade.uuid,
            request.user.id,
        )
        return response

    except ApiError as e:
        # Catch custom ApiError and return JsonResponse based on its message and status_code
        logger.error(
            "Erro ao gerar correção da lista %s: %s", data.get('lista_atividade_id'), e.message
        )
        return JsonResponse({"error": e.message}, status=e.status_code)
    except Exception as e:
        logger.error("Erro inesperado ao gerar correcao: %s", e)
        return JsonResponse({"error": str(e)}, status=400)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def baixar_ultima_atividade(request, lista_uuid):
    """Gera o PDF do modelo mais recente de uma lista."""
    try:
        modelo = (
            ModeloAtividade.objects
            .filter(lista_atividade__uuid=lista_uuid)
            .select_related("lista_atividade")
            .order_by("-criado_em")
            .first()
        )
        if not modelo:
            return JsonResponse({"error": "Modelo não encontrado."}, status=404)

        lista_atividade = modelo.lista_atividade
        resultados = (
            ResultadoQuestaoModelo.objects
            .filter(modelo_atividades=modelo)
            .select_related("questao")
            .order_by("questao__id")
        )
        questoes_validas = [
            (r.questao, r.peso_definido if r.peso_definido is not None else 1.0)
            for r in resultados
        ]

        qr_image_reportlab = _generate_qr_image_data(modelo)

        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        p.setFont("Times-Roman", 12)

        margin_x = 20 * mm
        right_margin = 10 * mm
        page_number = 1

        draw_bncc_header(p, width, height, lista_atividade.habilidades.all())
        draw_footer(p, width, height, page_number)
        current_y = draw_school_header(p, width, height, margin_x, right_margin)

        layout = _calculate_gabarito_qr_layout(
            width, height, current_y, len(questoes_validas)
        )

        draw_gabarito_frame_and_instructions(
            p,
            layout,
            "Preencha todo o tracejado do retângulo escolhido!",
            modelo.identificador_qr,
        )
        draw_qrcode_inside_gabarito(p, qr_image_reportlab, layout["qr_x"], layout["qr_y"])
        draw_gabarito_section(
            p,
            questoes_validas,
            modelo,
            layout,
            layout["box_y"] + layout["box_height"] - 10 * mm - 5 * mm,
        )

        start_questions_y = layout["box_y"] - 5 * mm

        def my_header(p_canvas, page_number):
            draw_bncc_header(p_canvas, width, height, lista_atividade.habilidades.all())
            draw_footer(p_canvas, width, height, page_number)

        p, page_number = draw_questions_section(
            p,
            questoes_validas,
            start_questions_y,
            margin_x,
            width,
            height,
            header_func=my_header,
            page_number=page_number,
        )

        p.save()
        buffer.seek(0)
        response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{lista_atividade.nome}.pdf"'
        logger.success(
            "PDF da lista %s gerado para usuario %s",
            lista_uuid,
            request.user.id,
        )
        return response
    except Exception as e:
        logger.error("Erro ao gerar PDF da lista %s: %s", lista_uuid, e)
        return JsonResponse({"error": str(e)}, status=400)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def baixar_ultima_solucao(request, lista_uuid):
    """Gera o PDF de soluções do modelo mais recente de uma lista."""
    try:
        modelo = (
            ModeloAtividade.objects
            .filter(lista_atividade__uuid=lista_uuid)
            .select_related("lista_atividade")
            .order_by("-criado_em")
            .first()
        )
        if not modelo:
            return JsonResponse({"error": "Modelo não encontrado."}, status=404)

        lista_atividade = modelo.lista_atividade
        resultados = (
            ResultadoQuestaoModelo.objects
            .filter(modelo_atividades=modelo)
            .select_related("questao")
            .order_by("questao__id")
        )
        questoes_validas = [
            (r.questao, r.peso_definido if r.peso_definido is not None else 1.0)
            for r in resultados
        ]

        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        margin_x = 20 * mm
        y = height - 25 * mm

        styles = getSampleStyleSheet()
        style_q = styles["Normal"]
        style_q.fontName = "Times-Bold"
        style_q.fontSize = 11
        style_q.leading = 14

        style_a = styles["Normal"]
        style_a.fontName = "Times-Roman"
        style_a.fontSize = 11
        style_a.leading = 14

        for idx, (questao, _) in enumerate(questoes_validas, start=1):
            para_q = Paragraph(f"<b>Q{idx}</b> - {questao.enunciado}", style_q)
            w, h = para_q.wrap(width - 2 * margin_x, y)
            if y - h < 30 * mm:
                p.showPage()
                y = height - 25 * mm
            para_q.drawOn(p, margin_x, y - h)
            y -= h + 3 * mm

            # 1️⃣  Tente usar primeiro a solução explícita cadastrada na questão
            if questao.solucao:
                sol_text = questao.solucao

            # 2️⃣  Se não houver solução na questão e ela for discursiva,
            #     use a resposta discursiva (caso exista)
            elif questao.tipo == "discursiva":
                sol_text = questao.resposta_discursiva or ""

            # 3️⃣  Como último recurso, para questões objetivas sem solução preenchida,
            #     caia na alternativa correta
            else:  # questao.tipo == "objetiva"
                alt = Alternativa.objects.filter(questao=questao, correta=True).first()
                sol_text = alt.texto if alt else ""

            para_a = Paragraph(sol_text, style_a)
            w, h = para_a.wrap(width - 2 * margin_x, y)
            if y - h < 25 * mm:
                p.showPage()
                y = height - 25 * mm
            para_a.drawOn(p, margin_x + 10, y - h)
            y -= h + 10

        p.save()
        buffer.seek(0)
        response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="solucoes_{lista_atividade.nome}.pdf"'
        )
        logger.success(
            "PDF de soluções da lista %s gerado para usuario %s",
            lista_uuid,
            request.user.id,
        )
        return response
    except Exception as e:
        logger.error("Erro ao gerar PDF de soluções da lista %s: %s", lista_uuid, e)
        return JsonResponse({"error": str(e)}, status=400)


@api_view(["GET"])
@permission_classes([AllowAny])
def respostas_modelo(request, identificador_qr):
    """Retorna gabarito de um modelo a partir do identificador QR."""
    try:
        modelo = ModeloAtividade.objects.get(identificador_qr=identificador_qr)
    except ModeloAtividade.DoesNotExist:
        return Response({"error": "Modelo não encontrado."}, status=404)

    resultados = (
        ResultadoQuestaoModelo.objects
        .filter(modelo_atividades=modelo)
        .select_related("questao")
        .order_by("questao__id")
    )

    questoes = []
    for r in resultados:
        q = r.questao
        resposta = r.alternativa_correta if q.tipo == "objetiva" else q.resposta_discursiva
        questoes.append({
            "enunciado": q.enunciado,
            "tipo": q.tipo,
            "resposta": resposta,
            "uuid": str(q.uuid),
            "solucao": q.solucao,
        })

    logger.success(
        "Gabarito retornado para modelo %s", identificador_qr
    )
    return Response({
        "questoes": questoes,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def gerar_solucoes_atividade(request):
    """Gera PDF contendo enunciado e solução das questões da lista."""
    try:
        data = json.loads(request.body)

        lista_atividade, questoes_validas, _ = _process_request_data(data)

        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        margin_x = 20 * mm
        y = height - 25 * mm

        styles = getSampleStyleSheet()
        style_q = styles["Normal"]
        style_q.fontName = "Times-Bold"
        style_q.fontSize = 11
        style_q.leading = 14

        style_a = styles["Normal"]
        style_a.fontName = "Times-Roman"
        style_a.fontSize = 11
        style_a.leading = 14

        for idx, (questao, _) in enumerate(questoes_validas, start=1):
            para_q = Paragraph(f"<b>Q{idx}</b> - {questao.enunciado}", style_q)
            w, h = para_q.wrap(width - 2 * margin_x, y)
            if y - h < 30 * mm:
                p.showPage()
                y = height - 25 * mm
            para_q.drawOn(p, margin_x, y - h)
            y -= h + 3 * mm

            # 1️⃣  Tente usar primeiro a solução explícita cadastrada na questão
            if questao.solucao:
                sol_text = questao.solucao

            # 2️⃣  Se não houver solução na questão e ela for discursiva,
            #     use a resposta discursiva (caso exista)
            elif questao.tipo == "discursiva":
                sol_text = questao.resposta_discursiva or ""

            # 3️⃣  Como último recurso, para questões objetivas sem solução preenchida,
            #     caia na alternativa correta
            else:  # questao.tipo == "objetiva"
                alt = Alternativa.objects.filter(questao=questao, correta=True).first()
                sol_text = alt.texto if alt else ""

            para_a = Paragraph(sol_text, style_a)
            w, h = para_a.wrap(width - 2 * margin_x, y)
            if y - h < 25 * mm:
                p.showPage()
                y = height - 25 * mm
            para_a.drawOn(p, margin_x + 10, y - h)
            y -= h + 10

        p.save()
        buffer.seek(0)
        response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="solucoes_{lista_atividade.nome}.pdf"'
        )
        logger.success(
            "PDF de solucoes da lista %s gerado para usuario %s",
            lista_atividade.uuid,
            request.user.id,
        )
        return response
    except ApiError as e:
        logger.error(
            "Erro ao gerar solucoes da lista %s: %s", data.get('lista_atividade_id'), e.message
        )
        return JsonResponse({"error": e.message}, status=e.status_code)
    except Exception as e:
        logger.error("Erro inesperado ao gerar solucoes: %s", e)
        return JsonResponse({"error": str(e)}, status=400)
