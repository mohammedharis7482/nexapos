from pathlib import Path

from decouple import Csv, config

BASE_DIR = Path(__file__).resolve().parents[2]

SECRET_KEY = config("DJANGO_SECRET_KEY", default="unsafe-development-key-change-me")
DEBUG = False
ALLOWED_HOSTS: list[str] = []

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "django_filters",
    "corsheaders",
    "drf_spectacular",
    "apps.accounts.apps.AccountsConfig",
    "apps.shops.apps.ShopsConfig",
    "apps.products.apps.ProductsConfig",
    "apps.inventory.apps.InventoryConfig",
    "apps.sales.apps.SalesConfig",
    "apps.payments.apps.PaymentsConfig",
    "apps.reports.apps.ReportsConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "common.middleware.RequestIdMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("POSTGRES_DB", default="nexapos"),
        "USER": config("POSTGRES_USER", default="nexapos_user"),
        "PASSWORD": config("POSTGRES_PASSWORD", default="change-me"),
        "HOST": config("POSTGRES_HOST", default="localhost"),
        "PORT": config("POSTGRES_PORT", default="5432"),
        "CONN_MAX_AGE": 60,
    }
}

AUTH_USER_MODEL = "accounts.User"
AUTHENTICATION_BACKENDS = ["common.authentication.ShopModelBackend"]
# Usernames are intentionally unique per shop; ShopModelBackend handles the scope.
SILENCED_SYSTEM_CHECKS = ["auth.W004"]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Qatar"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOWED_ORIGINS = config("CORS_ALLOWED_ORIGINS", cast=Csv(), default="")
CSRF_TRUSTED_ORIGINS = config("CSRF_TRUSTED_ORIGINS", cast=Csv(), default="")

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "common.authentication.ApiSessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "common.pagination.StandardResultsSetPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "common.exceptions.api_exception_handler",
    "DEFAULT_THROTTLE_RATES": {
        "login_ip": config("LOGIN_IP_RATE", default="30/min"),
        "login_context": config("LOGIN_CONTEXT_RATE", default="10/min"),
    },
    # Do not trust spoofable X-Forwarded-For values unless the deployment sets
    # the exact number of trusted proxies.
    "NUM_PROXIES": config("DRF_NUM_PROXIES", cast=int, default=0),
}

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = False
CORS_ALLOW_CREDENTIALS = True
SESSION_COOKIE_AGE = config("SESSION_COOKIE_AGE_SECONDS", cast=int, default=28800)
SESSION_EXPIRE_AT_BROWSER_CLOSE = config(
    "SESSION_EXPIRE_AT_BROWSER_CLOSE", cast=bool, default=False
)
SESSION_SAVE_EVERY_REQUEST = config(
    "SESSION_SAVE_EVERY_REQUEST", cast=bool, default=False
)
SESSION_COOKIE_DOMAIN = config("SESSION_COOKIE_DOMAIN", default=None) or None
CSRF_COOKIE_DOMAIN = config("CSRF_COOKIE_DOMAIN", default=None) or None

SPECTACULAR_SETTINGS = {
    "TITLE": "NexaPOS API",
    "DESCRIPTION": "API for the NexaPOS grocery point-of-sale platform.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {name} {message}",
            "style": "{",
        },
        "json": {"()": "common.logging.SafeJsonFormatter"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": config("DJANGO_LOG_FORMAT", default="verbose"),
        }
    },
    "root": {
        "handlers": ["console"],
        "level": config("DJANGO_LOG_LEVEL", default="INFO"),
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "nexapos.api": {
            "handlers": ["console"],
            "level": config("DJANGO_LOG_LEVEL", default="INFO"),
            "propagate": False,
        },
    },
}
