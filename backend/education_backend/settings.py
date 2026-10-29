from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
import os, logging, logging_loki

# === BASE DIR ===
BASE_DIR = Path(__file__).resolve().parent.parent

# === CARREGAR VARIÁVEIS DO .env ===
load_dotenv(os.path.join(BASE_DIR, '.env'))

# === VARIÁVEIS DE AMBIENTE ===
SECRET_KEY = os.getenv("SECRET_KEY")
DEBUG = os.getenv("DEBUG", "False") == "True"
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost").split(",")
ENV = os.getenv("ENV", "production")
LOKI_URL = os.getenv("LOKI_URL")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


# === Roteamento principal do projeto
ROOT_URLCONF = 'education_backend.urls'


# === Diretorio de imagens
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')


# === ARQUIVOS ESTÁTICOS ===
STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles') # <-- ADICIONE OU AJUSTE ESTA LINHA!


# === APLICAÇÕES ===
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Terceiros
    'corsheaders',
    'rest_framework',

    # Apps do projeto
    'usuario',
    'atividades',
    'autenticacao',
    'conteudo',
    'planos',
    'resumos',
    'pdfgenerator',
    'docxgenerator',
    'notificacoes',
    'mapas_mentais',
    'llm',
]


# === EMAIL ===

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = EMAIL_HOST_USER


# === MIDDLEWARE ===
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'education_backend.middleware.RequestLogMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]


# === CSRF / CORS ===
CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",")
    if origin.strip()
]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
]

# Headers comuns p/ cookies/CSRF com fetch:
CORS_ALLOW_HEADERS = [
    'authorization', 'content-type', 'x-csrftoken', 'x-requested-with',
]
CORS_EXPOSE_HEADERS = ['Content-Type']
CORS_ALLOW_CREDENTIALS = True

# ========================= Celery =========================
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/1")

CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 8
CELERY_RESULT_EXPIRES = 3600
CELERY_BROKER_POOL_LIMIT = 50
CELERY_BROKER_TRANSPORT_OPTIONS = {
    "visibility_timeout": 60 * 20,  # 20 min – maior que o pior tempo de task
}

# === REST FRAMEWORK ===
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'autenticacao.authentication.CookieJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=4),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,

    # 💡 MUDANÇA AQUI:
    'AUTH_HEADER_TYPES': ('',), # Definir como tupla vazia para que JWT não olhe para Authorization header
    'AUTH_COOKIE': 'access_token', # Nome do cookie que contém o access token
    'AUTH_COOKIE_DOMAIN': None,    # Defina se seu frontend estiver em um subdomínio diferente
    'AUTH_COOKIE_SECURE': True,   # True em produção (HTTPS)
    'AUTH_COOKIE_HTTP_ONLY': True,
    'AUTH_COOKIE_SAMESITE': 'Lax',
    'AUTH_COOKIE_PATH': '/',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'USER_AUTHENTICATION_RULE': 'rest_framework_simplejwt.authentication.default_user_authentication_rule',
    # ... outras configurações do SIMPLE_JWT
}


# === BANCO DE DADOS ===
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv("DB_NAME"),
        'USER': os.getenv("DB_USER"),
        'PASSWORD': os.getenv("DB_PASSWORD"),
        'HOST': os.getenv("DB_HOST", "localhost"), # Se você estiver em um ambiente WSL2 rodando um conteiner para o postgres, troque o que está aqui por: "host.docker.internal"
        # Quando você usa host.docker.internal dentro do WSL, o Docker Desktop intercepta essa requisição e a roteia explicitamente para o seu host Windows, onde o PostgreSQL está
        'PORT': os.getenv("DB_PORT", "5432"),
    }
}
DATABASES["default"]["CONN_MAX_AGE"] = 60  # mantém conexões abertas p/ reduzir handshakes por thread


# === ASGI ===
ASGI_APPLICATION = 'education_backend.asgi.application'


# === TEMPLATES ===
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]


# === WSGI ===
WSGI_APPLICATION = 'education_backend.wsgi.application'


# === USUÁRIO CUSTOMIZADO ===
AUTH_USER_MODEL = 'usuario.Usuario'
AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    'usuario.utils.EmailOrUsernameModelBackend',
]


# === SEGURANÇA ===
SECURE_SSL_REDIRECT = os.getenv("REDIRECT_SSL", "False") == "True"
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
X_FRAME_OPTIONS = 'SAMEORIGIN'

# === INTERNACIONALIZAÇÃO ===
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# === PRIMARY KEY DEFAULT ===
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# === VALIDAÇÃO DE SENHAS ===
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# === LOGGING ===
class ColoredFormatter(logging.Formatter):
    COLOR_CODES = {
        'DEBUG':    '\033[0;37m',
        'INFO':     '\033[0;37m',
        'WARNING':  '\033[0;31m',
        'ERROR':    '\033[0;31m',
        'CRITICAL': '\033[0;31;1m',
        'SUCCESS':  '\033[0;32m',
        'RESET':    '\033[0m',
    }
    def format(self, record):
        log_color = self.COLOR_CODES.get(record.levelname, self.COLOR_CODES['DEBUG'])
        formatter = logging.Formatter(
            f'{log_color}%(asctime)s %(levelname)-8s %(name)s %(message)s{self.COLOR_CODES["RESET"]}'
        )
        return formatter.format(record)

if not hasattr(logging, 'SUCCESS'):
    logging.SUCCESS = 25
    logging.addLevelName(logging.SUCCESS, 'SUCCESS')
    logging.Logger.success = (
        lambda self, msg, *args, **kw: self._log(logging.SUCCESS, msg, args, **kw)
    )

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,

    # ---------------------------------------------------------------- FORMATTERS
    'formatters': {
        'colored': { '()': ColoredFormatter },
        'simple':  { 'format': '%(asctime)s %(levelname)-8s %(name)s %(message)s' },
    },

    # ---------------------------------------------------------------- HANDLERS
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'level': 'INFO',
            'formatter': 'colored',
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'debug.log'),
            'level': 'DEBUG',
            'formatter': 'simple',
            'encoding': 'utf-8',
        },
        'loki': {
            'class': 'logging_loki.LokiHandler',
            'url': LOKI_URL or 'http://invalid',
            'tags': {'app': 'education_backend'},
            'version': '1',
            'level': 'DEBUG',          # envia DEBUG↑ dos seus apps
        },
    },

    # ---------------------------------------------------------------- ROOT LOGGER
    'root': {
        'handlers': ['console', 'file', 'loki'],
        'level': 'DEBUG',
    },

    # ---------------------------------------------------------------- ESPECIAIS
    'loggers': {
        # Evita recursão: esses loggers não vão para o handler 'loki'
        'logging_loki': { 'level': 'WARNING', 'handlers': ['console'], 'propagate': False },
        'urllib3':      { 'level': 'WARNING', 'handlers': ['console'], 'propagate': False },
        'requests':     { 'level': 'WARNING', 'handlers': ['console'], 'propagate': False },
    },
}
