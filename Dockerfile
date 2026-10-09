# ==============================================================================
# Dockerfile - Sistema de Auditoría de Citas & Cumplimiento Multicanal (KPI RED)
# ==============================================================================
FROM node:22-alpine

# Instalar utilidades básicas para diagnósticos y zona horaria
RUN apk add --no-cache tzdata curl
ENV TZ=America/El_Salvador

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar manifiestos de dependencias primero para aprovechar caché de capas Docker
COPY package.json ./

# Instalar dependencias (incluyendo tsx y vite para compilación y ejecución)
RUN npm install

# Copiar el código fuente del proyecto
COPY . .

# Compilar el frontend de React + Vite a archivos estáticos optimizados (/app/dist)
RUN npm run build

# Asegurar que exista el directorio de persistencia local del backend
RUN mkdir -p /app/data

# Variables de entorno por defecto para producción
ENV NODE_ENV=production
ENV PORT=3000

# Exponer el puerto 3000 (Frontend SPA + Backend API Express en un solo puerto)
EXPOSE 3000

# Healthcheck automático para monitoreo del contenedor Docker
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Iniciar el servidor unificado (sirve /dist estático + rutas /api/* en caliente)
CMD ["npx", "tsx", "server.ts"]
