from django.core.exceptions import ImproperlyConfigured
from decouple import Csv, config

from .base import *  # noqa: F403

DEBUG = False
SECRET_KEY = config("DJANGO_SECRET_KEY")
ALLOWED_HOSTS = config("DJANGO_ALLOWED_HOSTS", cast=Csv())
CORS_ALLOWED_ORIGINS = config("CORS_ALLOWED_ORIGINS", cast=Csv(), default="")
CSRF_TRUSTED_ORIGINS = config("CSRF_TRUSTED_ORIGINS", cast=Csv(), default="")

if not ALLOWED_HOSTS:
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must be set in production.")
if "*" in ALLOWED_HOSTS:
    raise ImproperlyConfigured("Wildcard hosts are not allowed in production.")
if "*" in CORS_ALLOWED_ORIGINS:
    raise ImproperlyConfigured("Wildcard CORS origins are not allowed in production.")

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = config("DJANGO_SESSION_COOKIE_SECURE", cast=bool, default=True)
CSRF_COOKIE_SECURE = config("DJANGO_CSRF_COOKIE_SECURE", cast=bool, default=True)
SECURE_SSL_REDIRECT = config("DJANGO_SECURE_SSL_REDIRECT", cast=bool, default=True)
SECURE_HSTS_SECONDS = config("DJANGO_SECURE_HSTS_SECONDS", cast=int, default=3600)
SECURE_HSTS_INCLUDE_SUBDOMAINS = config(
    "DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", cast=bool, default=True
)
SECURE_HSTS_PRELOAD = config("DJANGO_SECURE_HSTS_PRELOAD", cast=bool, default=False)
SECURE_CONTENT_TYPE_NOSNIFF = True

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"
    },
}
