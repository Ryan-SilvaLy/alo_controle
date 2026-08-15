from pathlib import Path
from datetime import timedelta
import os
from dotenv import load_dotenv
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env', override=True)

# ========================
# SECURITY
# ========================

SECRET_KEY = os.getenv('SECRET_KEY', 'chave-insegura-apenas-local')

def env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def env_list(name, default=""):
    value = os.getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


def normalize_origin(origin):
    origin = origin.strip().rstrip("/")
    if not origin:
        return None
    if "://" not in origin:
        origin = f"https://{origin}"
    return origin


DEBUG = env_bool("DEBUG", True)

ALLOWED_HOSTS = ["*"]

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

AUTH_USER_MODEL = 'app_usuario.Usuario'


# ========================
# APPS
# ========================

INSTALLED_APPS = [
    # Seus apps
    'app_assinatura_epi',
    'app_controle',
    'app_item',
    'app_pedido',
    'app_usuario',
    'app_produto',

    # Terceiros
    'rest_framework',
    'corsheaders',

    # Django
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

# ========================
# MIDDLEWARE
# ========================

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',

    'whitenoise.middleware.WhiteNoiseMiddleware',  # importante produção

    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# ========================
# CORE
# ========================

ROOT_URLCONF = 'sistema.urls'

WSGI_APPLICATION = 'sistema.wsgi.application'

# ========================
# TEMPLATES
# ========================

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

# ========================
# DATABASE
# ========================

DATABASE_URL = os.getenv("DATABASE_URL")
DATABASE_SSL_REQUIRE = os.getenv("DATABASE_SSL_REQUIRE")

if DATABASE_SSL_REQUIRE is None:
    banco_local = DATABASE_URL and ("localhost" in DATABASE_URL or "127.0.0.1" in DATABASE_URL)
    DATABASE_SSL_REQUIRE = (not DEBUG) and not banco_local
else:
    DATABASE_SSL_REQUIRE = env_bool("DATABASE_SSL_REQUIRE")

DATABASES = {
    "default": dj_database_url.config(
        default=DATABASE_URL,
        conn_max_age=600,
        ssl_require=DATABASE_SSL_REQUIRE,
    )
}

# ========================
# PASSWORDS
# ========================

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# ========================
# INTERNATIONAL
# ========================

LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'

USE_I18N = True
USE_TZ = True

# ========================
# STATIC FILES
# ========================

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# ========================
# DEFAULT FIELD
# ========================

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ========================
# DJANGO REST
# ========================

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

# ========================
# JWT
# ========================

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=7),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

# ========================
# CORS
# ========================

DEFAULT_CORS_ALLOWED_ORIGINS = [
    "http://localhost:4200",
    "http://127.0.0.1:4200",
    "https://alo-controle.vercel.app",
]

configured_cors_origins = (
    env_list("CORS_ALLOWED_ORIGINS")
    + env_list("FRONTEND_URL")
    + env_list("FRONTEND_URLS")
)

CORS_ALLOW_ALL_ORIGINS = (
    env_bool("CORS_ALLOW_ALL_ORIGINS", False)
    or "*" in configured_cors_origins
)
CORS_ALLOWED_ORIGINS = sorted(
    {
        origin
        for origin in (
            normalize_origin(origin)
            for origin in DEFAULT_CORS_ALLOWED_ORIGINS + configured_cors_origins
            if origin != "*"
        )
        if origin
    }
)

CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS
CORS_ALLOW_CREDENTIALS = env_bool("CORS_ALLOW_CREDENTIALS", True)

# ========================
# WHITENOISE
# ========================

STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage" 
