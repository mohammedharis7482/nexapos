FROM node:22

WORKDIR /app

# Installed as its own layer so `npm install` is cached between builds and
# only re-runs when package.json/package-lock.json actually change.
COPY frontend/package.json frontend/package-lock.json /app/
RUN npm install

COPY frontend/ /app/

EXPOSE 3000
