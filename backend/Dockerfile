# Usa a imagem base oficial do Python 3.11 slim
FROM python:3.11-slim-bookworm

# Define variáveis de ambiente
ENV PYTHONUNBUFFERED 1

# Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copia o arquivo de requisitos e instala as dependências.
# Inclui a instalação de pacotes de sistema operacional necessários para psycopg2.
COPY requirements.txt /app/
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir -r requirements.txt

# Copia todo o código da sua aplicação para o diretório de trabalho
COPY . /app/

# Coleta os arquivos estáticos (se sua aplicação servir estáticos, o que é comum em produção)
# Lembre-se que em produção, idealmente, você usará um servidor como Nginx/Caddy para servir estáticos.
RUN python manage.py collectstatic --noinput

# Expõe a porta que o Django/Gunicorn irá rodar
EXPOSE 8000

# Comando para rodar a aplicação quando o contêiner iniciar
# Substitua 'education_backend' pelo nome real do seu projeto Django
CMD ["gunicorn", "--timeout", "150", "--bind", "0.0.0.0:8000", "education_backend.wsgi:application"]

