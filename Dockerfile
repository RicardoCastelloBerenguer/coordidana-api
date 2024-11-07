# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/go/dockerfile-reference/

# Want to help us make this template better? Share your feedback here: https://forms.gle/ybq9Krt8jtBL3iCk7

ARG NODE_VERSION=21.1.0

FROM node:${NODE_VERSION}-alpine

# Establece el entorno como producción.
ENV NODE_ENV production

# Establece el directorio de trabajo.
WORKDIR /usr/src/app

# Copia los archivos de definición de dependencias y descarga dependencias.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copia el resto del código fuente.
COPY . .

# Construye la aplicación para producción.
# RUN npm run build

# Cambia el usuario a uno no privilegiado.
USER node

# Expone el puerto en el que la aplicación se ejecuta.
EXPOSE 3000

# Ejecuta la aplicación en modo producción.
CMD ["npm", "start"]

