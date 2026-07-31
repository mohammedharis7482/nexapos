from django.core.exceptions import ImproperlyConfigured
from decouple import Csv, config

from .base import *  # noqa: F403

DEBUG = False
SECRET_KEY = config("DJANGO_SECRET_KEY")
EMAIL_BACKEND = config(
    "DJANGO_EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend",
)
EMAIL_HOST = config("DJANGO_EMAIL_HOST", default="")
DEFAULT_FROM_EMAIL = config("DJANGO_DEFAULT_FROM_EMAIL", default="")
REQUIRE_EMAIL_VERIFICATION = config(
    "REQUIRE_EMAIL_VERIFICATION", cast=bool, default=True
)
ALLOWED_HOSTS = config("DJANGO_ALLOWED_HOSTS", cast=Csv())
CORS_ALLOWED_ORIGINS = config("CORS_ALLOWED_ORIGINS", cast=Csv(), default="")
CSRF_TRUSTED_ORIGINS = config("CSRF_TRUSTED_ORIGINS", cast=Csv(), default="")
DATABASES["default"].update(  # noqa: F405
    {
        "NAME": config("POSTGRES_DB"),
        "USER": config("POSTGRES_USER"),
        "PASSWORD": config("POSTGRES_PASSWORD"),
        "HOST": config("POSTGRES_HOST"),
        "PORT": config("POSTGRES_PORT", default="5432"),
    }
)

if not ALLOWED_HOSTS:
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must be set in production.")
if "*" in ALLOWED_HOSTS:
    raise ImproperlyConfigured("Wildcard hosts are not allowed in production.")
if "*" in CORS_ALLOWED_ORIGINS:
    raise ImproperlyConfigured("Wildcard CORS origins are not allowed in production.")
if CORS_ALLOWED_ORIGINS and not CSRF_TRUSTED_ORIGINS:
    raise ImproperlyConfigured(
        "CSRF_TRUSTED_ORIGINS is required when production CORS origins are set."
    )
if EMAIL_USE_TLS and EMAIL_USE_SSL:  # noqa: F405
    raise ImproperlyConfigured(
        "DJANGO_EMAIL_USE_TLS and DJANGO_EMAIL_USE_SSL cannot both be true."
    )
if EMAIL_BACKEND == "django.core.mail.backends.console.EmailBackend":  # noqa: F405
    local_validation_hosts = {"localhost", "127.0.0.1", "[::1]"}
    if not ALLOWED_HOSTS or not set(ALLOWED_HOSTS).issubset(local_validation_hosts):
        raise ImproperlyConfigured(
            "The console email backend is allowed only for local production "
            "validation. Configure a production email backend for public hosts."
        )
if EMAIL_BACKEND == "django.core.mail.backends.smtp.EmailBackend" and not all(  # noqa: F405
    (EMAIL_HOST, DEFAULT_FROM_EMAIL)
):
    raise ImproperlyConfigured(
        "SMTP production delivery requires DJANGO_EMAIL_HOST and "
        "DJANGO_DEFAULT_FROM_EMAIL."
    )

if config("DJANGO_TRUST_X_FORWARDED_PROTO", cast=bool, default=True):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = config("DJANGO_SESSION_COOKIE_SECURE", cast=bool, default=True)
CSRF_COOKIE_SECURE = config("DJANGO_CSRF_COOKIE_SECURE", cast=bool, default=True)
SESSION_COOKIE_SAMESITE = config("DJANGO_SESSION_COOKIE_SAMESITE", default="Lax")
CSRF_COOKIE_SAMESITE = config("DJANGO_CSRF_COOKIE_SAMESITE", default="Lax")
for setting_name, same_site in (
    ("DJANGO_SESSION_COOKIE_SAMESITE", SESSION_COOKIE_SAMESITE),
    ("DJANGO_CSRF_COOKIE_SAMESITE", CSRF_COOKIE_SAMESITE),
):
    if same_site not in {"Lax", "Strict", "None"}:
        raise ImproperlyConfigured(
            f"{setting_name} must be Lax, Strict, or None."
        )
if (
    (SESSION_COOKIE_SAMESITE == "None" and not SESSION_COOKIE_SECURE)
    or (CSRF_COOKIE_SAMESITE == "None" and not CSRF_COOKIE_SECURE)
):
    raise ImproperlyConfigured("SameSite=None cookies must remain Secure.")
SECURE_SSL_REDIRECT = config("DJANGO_SECURE_SSL_REDIRECT", cast=bool, default=True)
SECURE_HSTS_SECONDS = config("DJANGO_SECURE_HSTS_SECONDS", cast=int, default=0)
SECURE_HSTS_INCLUDE_SUBDOMAINS = config(
    "DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", cast=bool, default=False
)
SECURE_HSTS_PRELOAD = config("DJANGO_SECURE_HSTS_PRELOAD", cast=bool, default=False)
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

if config("POSTGRES_SSL_REQUIRE", cast=bool, default=False):
    DATABASES["default"]["OPTIONS"] = {"sslmode": "require"}  # noqa: F405

LOGGING["handlers"]["console"]["formatter"] = config(  # noqa: F405
    "DJANGO_LOG_FORMAT", default="json"
)
LOGGING["loggers"]["nexapos.request"]["level"] = config(  # noqa: F405
    "DJANGO_REQUEST_LOG_LEVEL", default="INFO"
)

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"
    },
}
