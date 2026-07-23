from decouple import Csv, config

from .base import *  # noqa: F403

DEBUG = config("DJANGO_DEBUG", cast=bool, default=True)
ALLOWED_HOSTS = config(
    "DJANGO_ALLOWED_HOSTS", cast=Csv(), default="localhost,127.0.0.1"
)
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS", cast=Csv(), default="http://localhost:3000"
)
CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS", cast=Csv(), default="http://localhost:3000"
)
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

LOGGING["root"]["level"] = "DEBUG"  # noqa: F405
LOGGING["loggers"]["django"]["level"] = "INFO"  # noqa: F405
