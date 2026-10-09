# DOCUMENTACIÓN TÉCNICA, FUNCIONAL Y DE INFRAESTRUCTURA
## Sistema de Auditoría de Citas & Cumplimiento Multicanal (KPI RED)

---

## PÁGINA 1: ¿DE QUÉ TRATA EL PROYECTO? (RESUMEN EJECUTIVO Y FUNCIONAL)

### 1.1 Propósito General del Sistema
El **Sistema de Auditoría de Citas & Cumplimiento Multicanal** es una plataforma web full-stack diseñada para auditar en tiempo real ("en caliente") la gestión comercial de los ejecutivos de ventas de **El Salvador (SV)** y **Guatemala (GT)**. Su objetivo central es verificar de manera automática y determinista si los ejecutivos contactan a tiempo a los prospectos asignados desde **Prospektia**, cruzando la información contra todos los canales de comunicación disponibles: **Telefonía PBX (con grabación de llamadas)**, **Llamadas de Celular**, **Llamadas de WhatsApp** y **Reuniones Virtuales de Microsoft Teams**.

### 1.2 Modos de Operación (Doble Flujo de Negocio)
El sistema opera bajo dos modalidades seleccionables en cualquier momento:

1. **Modo Leads Calificados (Citas Agendadas)**:
   - Audita prospectos que tienen una fecha y hora de cita programada (`fecha_agendada` / `hora_agendada`).
   - **KPI 1 (Cumplimiento de Llamadas ±5 min)**: Verifica si el ejecutivo llamó o se reunió con el cliente dentro de una ventana estricta de **5 minutos antes y 5 minutos después** de la hora pactada, dentro del horario laboral (8:00 AM a 6:00 PM, Lunes a Viernes), con una duración mínima efectiva (≥ 45 segundos).
   - **KPI 2 (SLA de Etapas)**: Evalúa el cumplimiento de tiempos de avance entre etapas del embudo comercial (Etapa 1 a Etapa 3).
   - **KPI 3 (Retroalimentación de Etapas)**: Audita el registro oportuno de feedback comercial en cada una de las 4 etapas del prospecto.

2. **Modo Leads No Calificados (Prospectos Directos)**:
   - Audita prospectos de entrada directa que no tienen cita previa agendada, evaluándolos a partir de su fecha y hora de creación (`fecha_creado` / `hora_creado`).
   - **Regla de 1 Hora / 9:00 AM Día Hábil Siguiente**:
     - Si el lead ingresa en horario laboral (Lun–Vie, 8:00 AM – 5:00 PM), el ejecutivo dispone de **máximo 60 minutos (1 hora)** para realizar el primer contacto efectivo.
     - Si el lead ingresa fuera de horario laboral o en fin de semana, el contacto debe realizarse a más tardar a las **9:00 AM del siguiente día hábil**.

### 1.3 Módulos Principales Incluidos
- **Visor de Registros por Fuente (Mes Actual Dinámico)**: Tablas interactivas para inspeccionar Llamadas PBX, Llamadas Celular, Llamadas WhatsApp, Leads Calificados, Leads No Calificados y Reuniones Teams. Por defecto carga siempre el **Mes Actual de forma 100% dinámica**, permitiendo filtrar por **Mes Anterior**, **Hoy** o cualquier rango de fechas personalizado.
- **Reproductor de Audio PBX Integrado**: Permite escuchar y descargar directamente en el navegador las grabaciones `.wav` de las llamadas de la planta telefónica (SV y GT) mediante un proxy autenticado en el backend.
- **Catálogo de Ejecutivos y Usuarios (CRUD + Login)**: Administración de ejecutivos, números de celular, extensiones PBX, país (`SV`/`GT`) y contraseñas de acceso al sistema.
- **Gestión Automática de Reuniones Teams**: Detección automática de leads con modalidad virtual y control de estados de evidencia.

---

## PÁGINA 2: ARQUITECTURA TÉCNICA Y FUENTES DE DATOS ("EN CALIENTE")

### 2.1 Stack Tecnológico
- **Lenguajes**: HTML5, CSS3 y JavaScript / TypeScript (ejecutado tanto en cliente como en servidor).
- **Frontend**: React 19 + Vite + Tailwind CSS + Lucide Icons (Single Page Application servida estáticamente en producción).
- **Backend**: Node.js 22 + Express (Servidor unificado en el puerto `3000` que actúa como orquestador de APIs, motor de persistencia local JSON y proxy de audio PBX).
- **Inteligencia Artificial**: **Ninguna dependencia de IA**. Toda la lógica de cruce telefónico (normalización a 8 dígitos locales), cálculo de desfases en minutos, reglas de días hábiles y KPIs es **100% algorítmica y determinista**, lo que garantiza velocidad inmediata, cero costos por tokens y precisión matemática.

### 2.2 Fuentes de Datos Integradas en el Backend
Cada vez que el usuario abre el sistema o cambia el filtro de fechas, el backend (`server.ts`) realiza consultas paralelas (`Promise.all`) a las siguientes fuentes:

| # | Fuente de Datos | Tipo de Consulta | Endpoint / Origen | Uso en el Sistema |
|---|---|---|---|---|
| **1** | **Prospektia: Leads Calificados** | **En Caliente (API REST)** | `GET https://prospektia.red.com.sv/api/external/leads-calificados` | Obtiene las citas agendadas de SV y GT en el rango de fechas solicitado. |
| **2** | **Prospektia: Leads No Calificados** | **En Caliente (API REST)** | `GET https://prospektia.red.com.sv/api/external/leads-no-calificados` | Obtiene los prospectos no calificados creados en el rango activo. |
| **3** | **Red PBX (El Salvador y Guatemala)** | **En Caliente (JWT + REST)** | `POST https://api.red.com.sv/login` + `GET /pbx/api/v1/getCalls2` | Descarga el historial de llamadas PBX (`SV` y `GT`) y provee streaming de grabaciones vía `/pbx/api/v1/rawCalls`. |
| **4** | **API KPI: Llamadas de Celular** | **En Caliente (API REST)** | `GET https://kpi.red.com.sv/api/historial-llamadas-ejecutivos` | Obtiene las llamadas salientes/entrantes de la flota celular corporativa. |
| **5** | **Supabase: Llamadas WhatsApp** | **Lectura REST Tabla** | `GET https://sbopifiiyezmvsadwkpg.supabase.co/rest/v1/llamadas_whatsapp` | Única fuente leída desde Supabase para incorporar llamadas registradas por WhatsApp. |
| **6** | **Almacén Persistente Local** | **Disco Local (`/app/data`)** | `/app/data/backendStore.json` | Persiste el Catálogo de Ejecutivos (y sus contraseñas), estados de Reuniones Teams y checks manuales de KPI 2 / KPI 3. |

---

## PÁGINA 3: CONSUMO DE RECURSOS Y DIMENSIONAMIENTO DE SERVIDOR

### 3.1 ¿Por qué el consumo de recursos es sumamente bajo?
El sistema fue diseñado con una arquitectura **Stateless de Consulta en Caliente + Almacenamiento Ligero**:
1. **No requiere un motor de base de datos pesado local** (no necesita correr PostgreSQL, MySQL ni MongoDB dentro del servidor), ya que las llamadas y leads se consultan en vivo desde las APIs de RED y el estado propio se guarda en `/app/data/backendStore.json` (archivo de pocos kilobytes).
2. **El cruce de auditoría se procesa en memoria en milisegundos** (< 15 ms para cientos de leads y miles de llamadas).
3. **El streaming de audio PBX actúa como pasarela (buffer ligero)** bajo demanda únicamente cuando un auditor presiona "Play" en una grabación específica.

### 3.2 Medición Real de Consumo de Recursos del Contenedor

| Recurso |En Reposo (Idle) | Durante Consulta en Caliente / Uso Activo | Pico Máximo (Streaming Audio + Sync Simultáneo) |
|---|---|---|---|
| **Memoria RAM (RSS)** | **~65 MB – 90 MB** | **~110 MB – 160 MB** | **~220 MB – 280 MB** |
| **CPU** | **< 1% de 1 vCPU** | **5% – 15% de 1 vCPU** (durante 1–2 seg) | **25% – 40% de 1 vCPU** |
| **Almacenamiento en Disco** | **~180 MB** (Imagen Docker + código compilado) | **< 5 MB adicionales** (`/app/data/backendStore.json` + logs) | **< 500 MB** totales incluyendo rotación de logs Docker |
| **Ancho de Banda (Red)** | Casi nulo | ~200 KB – 800 KB por sincronización JSON | ~500 KB – 2 MB por grabación `.wav` reproducida |

### 3.3 Especificaciones Recomendadas para Alojar en Servidor (VPS / Cloud / On-Premise)

Para alojar este proyecto de forma dedicada o compartida, estos son los requerimientos:

- **Configuración Mínima (Suficiente para 1 a 10 usuarios concurrentes)**:
  - **CPU**: 1 vCPU
  - **Memoria RAM**: 1 GB RAM (el contenedor usa ~120 MB; el resto queda libre para el sistema operativo Linux y Docker).
  - **Disco**: 10 GB SSD
  - **Sistema Operativo**: Ubuntu Server 22.04 LTS / 24.04 LTS o Debian 12.

- **Configuración Recomendada en Producción (Holgada y lista para crecer)**:
  - **CPU**: 1 a 2 vCPU
  - **Memoria RAM**: 2 GB RAM
  - **Disco**: 20 GB SSD
  - **Red**: Salida a internet HTTPS (puerto 443 saliente) para alcanzar `prospektia.red.com.sv`, `api.red.com.sv`, `kpi.red.com.sv` y `supabase.co`. Puerto `3000` (o `80`/`443` vía Nginx/Traefik) abierto para los usuarios.

---

## PÁGINA 4: GUÍA DE DESPLIEGUE CON DOCKER Y DOCKER COMPOSE

El proyecto ya incluye los archivos listos para producción en la raíz del repositorio:
- `Dockerfile`: Empaqueta Node.js 22 Alpine, compila el frontend de React (`npm run build`) y levanta el servidor Express en el puerto `3000`.
- `docker-compose.yml`: Configura el servicio `kpi-auditoria-red`, mapea el puerto `3000:3000`, monta el volumen persistente `./data:/app/data`, establece límites de seguridad de RAM (`512M`) y reinicio automático (`unless-stopped`).
- `.dockerignore`: Optimiza el peso de construcción excluyendo `node_modules` y archivos temporales.

### 4.1 Pasos para Desplegar en el Servidor

**Paso 1: Subir o clonar el proyecto en el servidor Linux**
```bash
git clone <URL_DEL_REPOSITORIO> kpi-auditoria-red
cd kpi-auditoria-red
```

**Paso 2: Construir y levantar el contenedor en segundo plano**
```bash
docker compose up -d --build
```

**Paso 3: Verificar que el contenedor está corriendo y saludable**
```bash
docker compose ps
docker compose logs -f
```
También puedes verificar el endpoint de salud y consumo de memoria:
```bash
curl http://localhost:3000/api/health
```

### 4.2 Persistencia de Datos y Respaldos (Backups)
- Todos los usuarios creados en el catálogo, sus contraseñas, asignaciones de extensión/celular y los estados de reuniones Teams se guardan automáticamente en la carpeta **`./data/backendStore.json`** del servidor anfitrión gracias al volumen configurado en `docker-compose.yml`.
- Aunque actualices o reconstruyas el contenedor (`docker compose up -d --build`), **los datos de `./data` se conservan intactos**.

### 4.3 Comandos Útiles de Mantenimiento
- **Reiniciar el servicio**: `docker compose restart`
- **Detener el servicio**: `docker compose down`
- **Ver consumo de RAM y CPU en vivo en Docker**: `docker stats kpi-auditoria-red`
