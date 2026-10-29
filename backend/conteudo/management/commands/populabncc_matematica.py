import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from conteudo.models import (
    Componente,
    AnoEscolar,
    UnidadeTematica,
    ObjetoConhecimento,
    Habilidade,
    MapaMental,
    CompetenciaGeral,
    CompetenciaEspecifica,
    Metodologia,
)


class Command(BaseCommand):
    """
    Popula o banco com:

      • Competências gerais e específicas  ➜  `competencias.json`
      • Habilidades BNCC                   ➜  arquivos listados em ARQUIVOS_JSON

    A partir desta versão, a dupla
        (codigo_bncc, objeto_conhecimento)
    é usada como chave de unicidade para habilidades.
    """

    help = "Popula o banco de dados com BNCC (habilidades, competências e metodologias)."

    # ------------------------------------------------------------------
    # Arquivos de dados
    # ------------------------------------------------------------------
    ARQUIVOS_JSON = [
        "BNCC 1° Ano - Matemática.json",
        "BNCC 2° Ano - Matemática.json",
        "BNCC 3° Ano - Matemática.json",
        "BNCC 4° Ano - Matemática.json",
        "BNCC 5° Ano - Matemática.json",
        "BNCC 6° Ano - Matemática.json",
        "BNCC 7° Ano - Matemática.json",
        "BNCC 8° Ano - Matemática.json",
        "BNCC 9° Ano - Matemática.json",
        "BNCC 1ª Série - Matemática.json",
        "BNCC 2ª Série - Matemática.json",
        "BNCC 3ª Série - Matemática.json",
    ]

    ARQUIVO_COMPETENCIAS = "competencias.json"
    ARQUIVO_METODOLOGIAS = "metodologias_referencias.json"

    # ---------------------- Helpers ----------------------
    def _parse_numeros(self, value):
        """
        Converte "1, 2, 3" | ["1","2"] | "1;2" -> [1,2,3]
        """
        if value is None:
            return []
        if isinstance(value, list):
            return [int(x) for x in value if str(x).strip().isdigit()]
        s = str(value).replace(";", ",")
        return [int(x.strip()) for x in s.split(",") if x.strip().isdigit()]

    # ------------------------------------------------------------------
    # Entrada principal
    # ------------------------------------------------------------------
    def handle(self, *args, **options):
        data_dir = Path(settings.BASE_DIR) / "conteudo" / "data" / "Matemática"

        # 1) Competências & Metodologias
        self._carregar_competencias(data_dir / self.ARQUIVO_COMPETENCIAS)
        self._carregar_metodologias(data_dir / self.ARQUIVO_METODOLOGIAS)

        # 2) Habilidades (um arquivo por ano/série)
        for nome in self.ARQUIVOS_JSON:
            caminho = data_dir / nome
            if not caminho.exists():
                self.stdout.write(self.style.WARNING(f"⚠️  Arquivo não encontrado: {nome}"))
                continue

            self.stdout.write(self.style.NOTICE(f"\n📄 Processando: {nome}"))
            self._processar_habilidades(caminho)

        self.stdout.write(self.style.SUCCESS("\n✅ Importação concluída."))

    # ------------------------------------------------------------------
    # Metodologias
    # ------------------------------------------------------------------
    def _carregar_metodologias(self, path: Path) -> None:
        if not path.exists():
            self.stdout.write(self.style.WARNING("⚠️  Arquivo de metodologias não encontrado."))
            return

        with path.open(encoding="utf-8") as f:
            data = json.load(f)

        novas = 0
        atualizadas = 0
        with transaction.atomic():
            # Processar metodologias ativas
            for item in data.get("metodologias_ativas", []):
                metodologia, created = Metodologia.objects.get_or_create(
                    nome=item["nome"].strip(),
                    defaults={
                        "definicao": item["definicao"].strip(),
                        "descricao": item.get("descricao", "").strip(),
                        "tipo": "Ativa",
                    },
                )
                if created:
                    novas += 1
                else:
                    # Atualizar conteúdo se já existir
                    alterado = False
                    if metodologia.definicao != item["definicao"].strip():
                        metodologia.definicao = item["definicao"].strip()
                        alterado = True
                    if metodologia.descricao != item.get("descricao", "").strip():
                        metodologia.descricao = item.get("descricao", "").strip()
                        alterado = True
                    if alterado:
                        metodologia.save()
                        atualizadas += 1

            # Processar metodologias expositivas
            for item in data.get("metodologia_expositiva", []):
                metodologia, created = Metodologia.objects.get_or_create(
                    nome=item["nome"].strip(),
                    defaults={
                        "definicao": item["definicao"].strip(),
                        "descricao": item.get("descricao", "").strip(),
                        "tipo": "Expositiva",
                    },
                )
                if created:
                    novas += 1
                else:
                    # Atualizar conteúdo se já existir
                    alterado = False
                    if metodologia.definicao != item["definicao"].strip():
                        metodologia.definicao = item["definicao"].strip()
                        alterado = True
                    if metodologia.descricao != item.get("descricao", "").strip():
                        metodologia.descricao = item.get("descricao", "").strip()
                        alterado = True
                    if alterado:
                        metodologia.save()
                        atualizadas += 1

        self.stdout.write(self.style.SUCCESS(f"🗂️  Metodologias importadas: +{novas} novas, {atualizadas} atualizadas"))

    # ------------------------------------------------------------------
    # Competências
    # ------------------------------------------------------------------
    def _carregar_competencias(self, path: Path) -> None:
        if not path.exists():
            self.stdout.write(self.style.WARNING("⚠️  Arquivo de competências não encontrado."))
            return

        data_dir: Path = path.parent

        with path.open(encoding="utf-8") as f:
            data = json.load(f)

        novas_gerais, novas_especificas = 0, 0
        with transaction.atomic():
            # -------------------- COMPETÊNCIAS GERAIS --------------------
            for item in data.get("competencias_gerais", []):
                comp, _ = Componente.objects.get_or_create(nome=item["componente"].strip())

                cg, created = CompetenciaGeral.objects.get_or_create(
                    numero=item["numero"],
                    componente=comp,
                    defaults={
                        "nome": item["nome"].strip(),
                        "descricao": item["descricao"].strip(),
                        "nivel_ensino": None,  # CG é transversal
                    },
                )
                if created:
                    novas_gerais += 1
                else:
                    # Mantém o nome sincronizado caso altere no JSON
                    novo_nome = item["nome"].strip()
                    if cg.nome != novo_nome:
                        cg.nome = novo_nome
                        cg.save(update_fields=["nome"])

            # ----------------- COMPETÊNCIAS ESPECÍFICAS ------------------
            for item in data.get("competencias_especificas", []):
                nome_chave = "componente" if "componente" in item else "componete"
                comp, _ = Componente.objects.get_or_create(nome=item[nome_chave].strip())

                _, created = CompetenciaEspecifica.objects.get_or_create(
                    numero=item["numero"],
                    componente=comp,
                    nivel_ensino=item["nivel_ensino"],
                    defaults={"descricao": item["descricao"].strip()},
                )
                if created:
                    novas_especificas += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"🗂️  Competências importadas → gerais: +{novas_gerais}, específicas: +{novas_especificas}"
            )
        )

        # ---------------------- Mapas Mentais ---------------------------
        mapas_mentais_root = data_dir / "mapas_mentais"
        mapas_criados = 0

        if mapas_mentais_root.exists():
            for area_path in mapas_mentais_root.iterdir():
                if not area_path.is_dir():
                    continue
                for comp_path in area_path.iterdir():
                    if not comp_path.is_dir():
                        continue
                    for pdf in comp_path.glob("*.pdf"):
                        nome_arquivo = pdf.name
                        caminho_relativo = pdf.relative_to(settings.BASE_DIR)
                        componente = comp_path.name  # ajuste conforme sua convenção

                        if not MapaMental.objects.filter(
                                nome_arquivo=nome_arquivo,
                                componente=componente,
                        ).exists():
                            MapaMental.objects.create(
                                componente=componente,
                                nome_arquivo=nome_arquivo,
                                caminho=str(caminho_relativo),
                            )
                            mapas_criados += 1

        self.stdout.write(self.style.SUCCESS(f"🗺️  Mapas mentais inseridos: {mapas_criados}"))

    # ------------------------------------------------------------------
    # Habilidades
    # ------------------------------------------------------------------
    def _processar_habilidades(self, path: Path) -> None:
        with path.open(encoding="utf-8") as f:
            data = json.load(f)

        criadas, atualizadas = 0, 0
        with transaction.atomic():
            for item in data:
                # 1) Componente
                comp, _ = Componente.objects.get_or_create(nome=item["componente"].strip())

                # 2) Ano Escolar
                raw_ano = item["ano"].strip()
                nivel = "Médio" if ("série" in raw_ano.lower() or "ª" in raw_ano) else "Fundamental"
                try:
                    numero = int("".join(filter(str.isdigit, raw_ano)))
                except ValueError:
                    self.stdout.write(self.style.ERROR(f"Ano inválido no JSON: {raw_ano}"))
                    continue

                ano_obj, _ = AnoEscolar.objects.get_or_create(numero_ano=numero, nivel_ensino=nivel)

                # 3) Unidade Temática (ou Campos de Atuação)
                raw_nome = item.get("unidades_tematicas") or item.get("campos_de_atuacao")
                if raw_nome:
                    nome_ut = raw_nome.strip()
                    ut, _ = UnidadeTematica.objects.get_or_create(nome=nome_ut)
                else:
                    self.stdout.write(
                        self.style.WARNING(
                            f"Registro sem unidade temática nem campos de atuação: código {item.get('codigo_bncc')}"
                        )
                    )
                    continue

                # 4) Objeto de Conhecimento
                oc, _ = ObjetoConhecimento.objects.get_or_create(
                    descricao=item["objetos_de_conhecimento"].strip()
                )

                # 5) Habilidade
                hab_padrao = {
                    "descricao": item["habilidade_bncc"].strip(),
                    "componente": comp,
                    "ano": ano_obj,
                    "unidade_tematica": ut,
                }

                hab, criada = Habilidade.objects.get_or_create(
                    codigo_bncc=item["codigo_bncc"].strip(),
                    objeto_conhecimento=oc,
                    ano=ano_obj,  # <- novo critério de unicidade
                    defaults=hab_padrao,
                )

                if criada:
                    criadas += 1
                else:
                    alterado = False
                    for campo, novo in hab_padrao.items():
                        if getattr(hab, campo) != novo:
                            setattr(hab, campo, novo)
                            alterado = True
                    if alterado:
                        hab.save(update_fields=list(hab_padrao.keys()))
                        atualizadas += 1

                # 6) Relações com Competências (Fundamental e Médio)
                # ---- Competências Gerais (números) ----
                numeros_cg = self._parse_numeros(item.get("competencias_gerais"))
                if numeros_cg:
                    cg_qs = CompetenciaGeral.objects.filter(
                        numero__in=numeros_cg,
                        componente=comp,
                    )
                    hab.competencias_gerais.set(list(cg_qs))
                    if len(cg_qs) != len(set(numeros_cg)):
                        faltantes_cg = set(numeros_cg) - set(cg_qs.values_list("numero", flat=True))
                        if faltantes_cg:
                            self.stdout.write(
                                self.style.WARNING(
                                    f"⚠️ CG ausentes para {item.get('codigo_bncc')}: {sorted(faltantes_cg)}"
                                )
                            )

                # ---- Competências Específicas (números OU descrição) ----
                numeros_ce = self._parse_numeros(item.get("competencias_especificas"))
                if numeros_ce:
                    ce_qs = CompetenciaEspecifica.objects.filter(
                        numero__in=numeros_ce,
                        componente=comp,
                        nivel_ensino=ano_obj.nivel_ensino,
                    )
                    hab.competencias_especificas.set(list(ce_qs))
                    if len(ce_qs) != len(set(numeros_ce)):
                        faltantes_ce = set(numeros_ce) - set(
                            ce_qs.values_list("numero", flat=True)
                        )
                        if faltantes_ce:
                            self.stdout.write(
                                self.style.WARNING(
                                    f"⚠️ CE ausentes para {item.get('codigo_bncc')}: {sorted(faltantes_ce)}"
                                )
                            )
                else:
                    # Fallback: arquivo antigo com CE como texto (descrição)
                    desc_ce = (item.get("competencias_especificas") or "").strip()
                    if desc_ce and not any(ch.isdigit() for ch in desc_ce):
                        ce = CompetenciaEspecifica.objects.filter(
                            descricao=desc_ce,
                            componente=comp,
                            nivel_ensino=ano_obj.nivel_ensino,
                        ).first()
                        if ce:
                            hab.competencias_especificas.set([ce])

        # Resumo do arquivo
        self.stdout.write(
            self.style.SUCCESS(f"📌 {path.name}: +{criadas} criadas, {atualizadas} atualizadas")
        )
