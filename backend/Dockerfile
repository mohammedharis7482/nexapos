FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Installed as its own layer so dependency installs are cached between builds
# and only re-run when the requirements files actually change.
COPY backend/requirements /app/requirements
RUN pip install --no-cache-dir -r requirements/development.txt

COPY backend/ /app/

EXPOSE 8000
