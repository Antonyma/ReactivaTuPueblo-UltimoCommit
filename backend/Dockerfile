FROM node:22-alpine

WORKDIR /app

# Instalar solo dependencias de producción
COPY package.json ./
RUN npm install --omit=dev

# Copiar el código fuente del backend
COPY src ./src

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]

