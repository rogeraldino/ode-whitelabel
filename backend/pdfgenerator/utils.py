from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.utils import ImageReader
import qrcode
from reportlab.lib.pagesizes import A4

from django.db import transaction # Import the transaction module

from io import BytesIO

from atividades.models import ListaAtividade, Questao, Alternativa
from pdfgenerator.models import ModeloAtividade, ResultadoQuestaoModelo # Import updated models

# Constants for OMR markers and general layout
OMR_SQUARE_SIZE = 5 * mm
OMR_LETTER_FONT_SIZE = 8
OMR_LETTER_SPACING = 8 * mm
OMR_INITIAL_LETTER_X_OFFSET = 15 * mm
OMR_OFFSET_LEFT = -5 * mm
OMR_OFFSET_RIGHT = -2 * mm
QUESTION_Y_OFFSET = 7 * mm
QR_CODE_SIZE = 60 * mm
GABARITO_EXTRA_HORIZONTAL_SPACE = 35 * mm # Valor adicional para diminuir a largura do gabarito. Ajuste conforme necessário.
ANSWER_RECT_WIDTH = 6 * mm  # Largura do retângulo de seleção
ANSWER_RECT_HEIGHT = 4 * mm # Altura do retângulo de seleção

# Constantes para espaçamento
ALTERNATIVA_INDENT = 10*mm
LINE_HEIGHT = 5*mm
SPACE_FOR_CALCULATIONS = 40*mm
DISCURSIVE_LINE_LENGTH = 75*mm # Ajustar para caber na coluna
QUESTION_SPACING = 10*mm # Espaço entre o fim de uma questão e o início da próxima


# --- NOVA CLASSE DE EXCEÇÃO ---
class ApiError(Exception):
    """Custom exception to carry API validation error details (message and status)."""
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
# --- FIM NOVA CLASSE DE EXCEÇÃO ---

# Estilos para os parágrafos
styles = getSampleStyleSheet()
styleN = styles['Normal']
styleN.fontName = 'Times-Roman'
styleN.fontSize = 10
styleN.leading = 12 # Espaçamento entre linhas

# Aumentar a leading do estilo normal para um espaçamento padrão entre as linhas de texto
# e ajustar para as alternativas conforme a necessidade, para não usar apenas LINE_HEIGHT
# styleN.leading = 12 # Já está definido, manter assim ou ajustar para o ideal para enunciados

def draw_questions_section(
        p, questoes_validas, initial_start_y, margin_x, page_width, page_height,
        footer_func=None, header_func=None, page_number=1
):
    styles = getSampleStyleSheet()
    style_quest = styles['Normal']
    style_quest.fontName = "Times-Roman"
    style_quest.fontSize = 11
    style_quest.leading = 14
    alt_indent = 8 * mm

    col_spacing = 10 * mm
    available_width = page_width - 2*margin_x - col_spacing
    col_width = available_width / 2
    usable_height = page_height - 20*mm  # Evita topo/rodapé

    col_xs = [margin_x, margin_x + col_width + col_spacing]
    col_ys = [initial_start_y, initial_start_y]
    max_bottom_y = 20*mm  # Margem inferior
    question_number = 1

    mid_x = (col_xs[0] + col_width) + (col_spacing / 2)
    # Desenha a linha vertical para a área de questões já nesta página!
    # Ajuste os limites inferior/superior conforme seu layout:
    line_top = initial_start_y
    line_bottom = 20*mm

    p.setLineWidth(0.5)
    p.setDash([])
    p.line(mid_x, line_bottom, mid_x, line_top)

    i = 0
    while i < len(questoes_validas):
        for col in [0, 1]:  # Tenta esquerda, se não couber tenta direita
            if i >= len(questoes_validas):
                break
            questao, peso = questoes_validas[i]

            enunciado_texto = f'<b>Q.{question_number} ({peso:.1f})</b> - {questao.enunciado}'
            para = Paragraph(enunciado_texto, style_quest)
            w, h = para.wrap(col_width, usable_height)
            curr_x = col_xs[col]
            curr_y = col_ys[col]
            total_h = h

            if questao.tipo == 'objetiva':
                alternativas = Alternativa.objects.filter(questao=questao).order_by("letra")
                alt_total_h = 0
                alt_list = []
                for alt in alternativas:
                    alt_text = f"<b>{alt.letra})</b> ( ) {alt.texto}"
                    para_alt = Paragraph(alt_text, style_quest)
                    w_alt, h_alt = para_alt.wrap(col_width - alt_indent, usable_height)
                    alt_list.append((para_alt, h_alt))
                    alt_total_h += h_alt + 1*mm
                total_h += alt_total_h
                total_h += 2*mm
            elif questao.tipo == 'discursiva':
                num_lines = 4
                line_len = col_width * 0.87
                line_gap = 15
                total_h += num_lines * line_gap + 2*mm

            total_h += 5*mm  # Margem extra

            # Testa se cabe nessa coluna
            if curr_y - total_h < max_bottom_y:
                continue  # Não coube, vai tentar a próxima coluna

            # Se coube, desenha
            para.drawOn(p, curr_x, curr_y - h)
            working_y = curr_y - h - 5*mm

            if questao.tipo == 'objetiva':
                for para_alt, h_alt in alt_list:
                    para_alt.drawOn(p, curr_x, working_y - h_alt)
                    working_y -= h_alt + 1*mm
                working_y -= 2*mm
            elif questao.tipo == 'discursiva':
                for _ in range(num_lines):
                    p.line(curr_x, working_y, curr_x + line_len, working_y )
                    working_y -= line_gap
                working_y -= 2*mm

            working_y -= 20*mm  # Espaço antes da próxima questão
            col_ys[col] = working_y  # Atualiza Y da coluna onde foi desenhada

            i += 1
            question_number += 1
            break  # Não tenta outra coluna
        else:
            # Não coube em nenhuma: nova página
            p.showPage()
            page_number += 1
            if header_func:
                header_func(p, page_number)
            # Recomeça ambas colunas do topo permitido
            col_ys = [page_height - margin_x, page_height - margin_x]
            # Desenha linha divisória de colunas:
            mid_x = (col_xs[0] + col_width) + (col_spacing / 2)
            p.setLineWidth(0.5)
            p.setDash([])
            p.line(mid_x, 15*mm, mid_x, page_height - 15*mm)  # Ajuste top/bottom do traço conforme margens do seu cabeçalho
    # Desenha linha vertical na última página também (caso não tenha usado showPage)
    mid_x = (col_xs[0] + col_width) + (col_spacing / 2)
    p.setLineWidth(0.5)
    p.setDash([])
    p.line(mid_x, 15*mm, mid_x, page_height - 15*mm)

    return p, page_number

def _create_models_in_db(lista_atividade, questoes_validas, questoes_ids_ordenadas):
    """
    Creates ModeloAtividade and ResultadoQuestaoModelo objects in the database.
    Returns the created ModeloAtividade object.
    """
    with transaction.atomic():
        modelo_atividade = ModeloAtividade.objects.create(
            lista_atividade=lista_atividade,
            nome_modelo=f"Modelo Padrão - {lista_atividade.nome}",
            ordem_questoes_randomizada=questoes_ids_ordenadas
        )

        for questao, peso in questoes_validas:
            alternativa_correta = None
            if questao.tipo == 'objetiva':
                try:
                    correta_obj = Alternativa.objects.get(questao=questao, correta=True)
                    alternativa_correta = correta_obj.letra
                except Alternativa.DoesNotExist:
                    pass

            ResultadoQuestaoModelo.objects.create(
                modelo_atividades=modelo_atividade,
                questao=questao,
                alternativa_correta=alternativa_correta,
                peso_definido=peso
            )
    return modelo_atividade


def draw_bncc_header(p, width, height, habilidades):
    """
    Escreve no canto superior-direito do PDF algo como:
        Códigos BNCC: EM13MAT203, EF06MA01, …

    • Remove duplicados (você pode ter várias habilidades com o mesmo código).
    • Ajusta automaticamente em várias linhas se não couber.
    • Sublinhe a última linha – como no original.
    """
    # ------------------------------------------------------------------
    # 1. Filtra e deduplica códigos
    # ------------------------------------------------------------------
    codigos = sorted({h.codigo_bncc for h in habilidades if h.codigo_bncc})
    if not codigos:
        return

    prefixo = "Códigos BNCC: "
    margem_direita = 11 * mm
    margem_topo = 12 * mm
    espaco_entre_linhas = 4 * mm
    offset_sublinhado = 2  # distância abaixo da baseline

    # ------------------------------------------------------------------
    # 2. Configura fonte
    # ------------------------------------------------------------------
    p.setFont("Times-Roman", 10)
    largura_max = width - margem_direita  # x onde o texto deve acabar
    x_final = largura_max

    # ------------------------------------------------------------------
    # 3. Quebra em linhas para caber no espaço disponível
    # ------------------------------------------------------------------
    linhas = []
    linha_atual = prefixo

    for codigo in codigos:
        separador = "" if linha_atual == prefixo else ", "
        possivel = f"{linha_atual}{separador}{codigo}"
        if p.stringWidth(possivel) > (width - margem_direita):
            # Fechou a linha
            linhas.append(linha_atual)
            linha_atual = prefixo + codigo  # começa nova linha com o prefixo
        else:
            linha_atual = possivel

    linhas.append(linha_atual)  # última linha

    # ------------------------------------------------------------------
    # 4. Desenha cada linha, alinhada à direita
    # ------------------------------------------------------------------
    y = height - margem_topo
    for i, texto in enumerate(linhas):
        texto_larg = p.stringWidth(texto)
        x = x_final - texto_larg
        p.drawString(x, y, texto)

        # Sublinhar apenas a última linha
        if i == len(linhas) - 1:
            p.line(x, y - offset_sublinhado, x + texto_larg, y - offset_sublinhado)

        y -= espaco_entre_linhas

def draw_school_header(p, width, height, margin_x=20*mm, right_margin=10*mm):
    # Aqui vai tudo: campos Professor, Disciplina, Aluno, Turma, Data, Nota box, etc
    # Você pode basicamente adaptar sua função draw_header atual,
    # Só não coloque o Código BNCC aqui; ele já está acima!
    # Exemplo (ajuste posições conforme preferir):
    current_y = height - 30*mm  # 30mm abaixo do topo/BNCC
    text_line_spacing = 8*mm
    line_start_x_offset = 25*mm
    line_length = 110*mm

    # Professor
    p.setFont("Times-Roman", 12)
    p.drawString(margin_x, current_y, "Professor:")
    p.line(margin_x + line_start_x_offset, current_y,
           margin_x + line_start_x_offset + line_length, current_y)
    current_y -= text_line_spacing
    # Disciplina
    p.drawString(margin_x, current_y, "Componente:")
    p.line(margin_x + line_start_x_offset, current_y,
           margin_x + line_start_x_offset + line_length, current_y)
    current_y -= text_line_spacing
    # Aluno
    p.drawString(margin_x, current_y, "Estudante:")
    p.line(margin_x + line_start_x_offset, current_y,
           margin_x + line_start_x_offset + line_length, current_y)
    current_y -= text_line_spacing
    # Turma/Data
    p.drawString(margin_x, current_y, "Turma:")
    p.line(margin_x + line_start_x_offset, current_y,
           margin_x + line_start_x_offset + 50*mm, current_y)
    date_text_start_x = margin_x + line_start_x_offset + 50*mm + 10*mm
    p.drawString(date_text_start_x, current_y, "Data: _____/_____/________")
    current_y -= 15*mm

    # Nota Box
    nota_box_width = 40*mm
    nota_box_height = 21.5*mm
    nota_box_x = width - right_margin - nota_box_width
    nota_box_y = height - 29*mm - nota_box_height
    p.rect(nota_box_x, nota_box_y, nota_box_width, nota_box_height)
    p.setFont("Times-Bold", 12)
    nota_text_width = p.stringWidth("Nota")
    p.drawString(nota_box_x + (nota_box_width - nota_text_width) / 2,
                 nota_box_y + nota_box_height - 7*mm, "Nota")

    # current_y retorna para ser passado como início das questões
    current_y -= -5*mm
    return current_y


def draw_omr_markers(p_canvas, gabarito_section_x_start, y_position, num_letters):
    """Draws the black OMR alignment squares."""
    square_y = y_position + (OMR_LETTER_FONT_SIZE / 2) - (OMR_SQUARE_SIZE / 2)

    # Square to the left of first letter
    p_canvas.rect(
        gabarito_section_x_start + OMR_INITIAL_LETTER_X_OFFSET - OMR_SQUARE_SIZE + OMR_OFFSET_LEFT,
        square_y,
        OMR_SQUARE_SIZE,
        OMR_SQUARE_SIZE,
        fill=1,
    )

    # Square to the right of last letter
    e_position_x = (
        gabarito_section_x_start + OMR_INITIAL_LETTER_X_OFFSET + (num_letters - 1) * OMR_LETTER_SPACING
    )
    p_canvas.rect(
        e_position_x + OMR_LETTER_SPACING + OMR_OFFSET_RIGHT,
        square_y,
        OMR_SQUARE_SIZE,
        OMR_SQUARE_SIZE,
        fill=1,
    )


def _generate_qr_image_data(modelo_atividade):
    """Generates the QR Code image data ready for ReportLab."""
    qr_data = str(modelo_atividade.identificador_qr) # The UUID of the activity model
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")

    # Converting the QR Code image to a format that ReportLab can use
    img_buffer = BytesIO()
    qr_img.save(img_buffer, format="PNG")
    img_buffer.seek(0)
    return ImageReader(img_buffer)


def _calculate_gabarito_qr_layout(width, height, current_y, num_questions, qr_code_size=QR_CODE_SIZE, margin=10*mm, spacing=8*mm):
    """
    Calcula o layout para o gabarito e QR em um único retângulo, com espaçamento adequado.
    """
    gabarito_box_height = (num_questions * QUESTION_Y_OFFSET) + 47 * mm
    gabarito_inner_width = width * 0.3 # Área disponível para conteúdo (gabarito + QR)
    total_content_width = gabarito_inner_width + qr_code_size + spacing

    # Centraliza bloco horizontalmente
    gabarito_box_x = (width - total_content_width) / 2
    gabarito_box_y = current_y - gabarito_box_height

    # Posição do QR code dentro do grande retângulo
    qr_code_x = gabarito_box_x + gabarito_inner_width + 4*mm
    qr_code_y = gabarito_box_y - 0.5*mm + (gabarito_box_height - qr_code_size) / 2

    return {
        "box_x": gabarito_box_x,
        "box_y": gabarito_box_y,
        "box_width": total_content_width,
        "box_height": gabarito_box_height,
        "qr_x": qr_code_x,
        "qr_y": qr_code_y,
        "gabarito_inner_x": gabarito_box_x,
        "gabarito_inner_width": gabarito_inner_width
    }

def draw_centered_text(p_canvas, text, x, y, width, font_name="Times-Roman", font_size=11):
    """
    Desenha texto centralizado horizontalmente em (x, y) no espaço dado por width.
    """
    p_canvas.setFont(font_name, font_size)
    text_width = p_canvas.stringWidth(text, font_name, font_size)
    text_x = x + (width - text_width) / 2
    p_canvas.drawString(text_x, y - 1*mm, text)

def draw_gabarito_frame_and_instructions(
        p_canvas, layout_dict, instrucoes, identificador_qr):
    """
    Desenha o frame retangular e os textos centralizados.
    """
    # Desenha o retângulo grande
    p_canvas.rect(layout_dict["box_x"], layout_dict["box_y"], layout_dict["box_width"], layout_dict["box_height"])

    # Linha divisória superior para instruções
    instruction_y = layout_dict["box_y"] + layout_dict["box_height"] - 6 * mm
    p_canvas.line(layout_dict["box_x"], instruction_y - 5*mm, layout_dict["box_x"] + layout_dict["box_width"], instruction_y - 5*mm)
    draw_centered_text(
        p_canvas, instrucoes,
        layout_dict["box_x"], instruction_y, layout_dict["box_width"]
    )

    # Linha divisória inferior
    line2_y = layout_dict["box_y"] + 10 * mm
    p_canvas.line(layout_dict["box_x"], line2_y, layout_dict["box_x"] + layout_dict["box_width"], line2_y)

    draw_centered_text(
        p_canvas, f"Prova: {identificador_qr}",
        layout_dict["box_x"], layout_dict["box_y"] + 5*mm, layout_dict["box_width"], font_size=10
    )

def draw_qrcode_inside_gabarito(p_canvas, qr_image_reportlab, qr_x, qr_y):
    p_canvas.drawImage(qr_image_reportlab, qr_x, qr_y, width=QR_CODE_SIZE, height=QR_CODE_SIZE)

def draw_gabarito_section(
        p_canvas, questoes_validas, modelo_atividade,
        layout_dict, line1_y):
    """
    Só o conteúdo do gabarito (questões e OMR), evitando sobreposição ao QR.
    """
    section_x_start = layout_dict["gabarito_inner_x"] + 5 * mm
    section_y_current = line1_y - 5*mm
    inner_width = layout_dict["gabarito_inner_width"]

    habilidade = modelo_atividade.lista_atividade.habilidades.first()
    nivel = getattr(getattr(habilidade, "ano", None), "nivel_ensino", "")
    if nivel == "Médio":
        letters = ['A', 'B', 'C', 'D', 'E']
    else:
        letters = ['A', 'B', 'C', 'D']
    letter_spacing = OMR_LETTER_SPACING
    initial_letter_x_offset = OMR_INITIAL_LETTER_X_OFFSET

    # Top letters + OMR
    p_canvas.setFont("Times-Bold", OMR_LETTER_FONT_SIZE)
    current_letter_x = section_x_start + initial_letter_x_offset
    for letter in letters:
        p_canvas.drawString(current_letter_x, section_y_current, letter)
        current_letter_x += letter_spacing
    draw_omr_markers(p_canvas, section_x_start, section_y_current, len(letters))

    section_y_current -= 10 * mm # Down for questions
    p_canvas.setFont("Times-Roman", 11)
    for i, (questao, peso) in enumerate(questoes_validas):
        question_number = i + 1
        q_text = f"Q.{question_number}:"
        p_canvas.drawString(section_x_start, section_y_current, q_text)

        if questao.tipo == 'objetiva':
            rect_width = ANSWER_RECT_WIDTH
            rect_height = ANSWER_RECT_HEIGHT
            center_y_for_rect = section_y_current + (2*mm)/2
            p_canvas.setDash(1, 2)
            circle_x_start = section_x_start + initial_letter_x_offset
            for j in range(len(letters)):
                center_x = circle_x_start + j * letter_spacing
                rect_x = center_x - (rect_width / 2)
                rect_y = center_y_for_rect - (rect_height / 2)
                p_canvas.rect(rect_x, rect_y, rect_width, rect_height, stroke=1, fill=0)
            p_canvas.setDash()
        elif questao.tipo == 'discursiva':
            p_canvas.drawString(section_x_start + initial_letter_x_offset, section_y_current, "Discursiva")
        section_y_current -= QUESTION_Y_OFFSET

    # Bottom letters + OMR
    p_canvas.setFont("Times-Bold", OMR_LETTER_FONT_SIZE)
    bottom_letters_y = layout_dict["box_y"] + 15 * mm
    current_letter_x = section_x_start + initial_letter_x_offset
    for letter in letters:
        p_canvas.drawString(current_letter_x, bottom_letters_y, letter)
        current_letter_x += letter_spacing
    draw_omr_markers(p_canvas, section_x_start, bottom_letters_y, len(letters))

def draw_footer(p, width, height, page_number, total_pages=None):
    p.setFont('Times-Roman', 9)

    # Página alinhado à esquerda
    left_margin = 20 * mm # ajuste conforme desejar
    footer_text = f"Página {page_number}" if not total_pages else f"Página {page_number} de {total_pages}"
    p.drawString(left_margin, 10*mm, footer_text)
