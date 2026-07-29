from decouple import Csv, config
from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403


DEBUG = config("DJANGO_DEBUG", cast=bool, default=True)

ALLOWED_HOSTS = config(
    "DJANGO_ALLOWED_HOSTS",
    cast=Csv(),
    default="localhost,127.0.0.1",
)

CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    cast=Csv(),
    default="http://localhost:3000,http://127.0.0.1:3000",
)

CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    cast=Csv(),
    default="http://localhost:3000,http://127.0.0.1:3000",
)

CORS_ALLOW_CREDENTIALS = True

EMAIL_BACKEND = config(
    "DJANGO_EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend",
)
REQUIRE_EMAIL_VERIFICATION = config(
    "REQUIRE_EMAIL_VERIFICATION", cast=bool, default=False
)

if EMAIL_USE_TLS and EMAIL_USE_SSL:  # noqa: F405
    raise ImproperlyConfigured(
        "DJANGO_EMAIL_USE_TLS and DJANGO_EMAIL_USE_SSL cannot both be true."
    )

SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

LOGGING["root"]["level"] = "DEBUG"  # noqa: F405
LOGGING["loggers"]["django"]["level"] = "INFO"  # noqa: F405
