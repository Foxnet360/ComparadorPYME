# Comparador de Seguros (CSA / Comparador PYME)

Plataforma inteligente de análisis, comparación y gestión de cotizaciones de seguros para corredores y áreas técnicas. Combina extracción multimodal con Google Gemini, ontología de coberturas con embeddings vectoriales (`pgvector`), gestión multi-tenant de portafolio y renovaciones, y una API B2B/DaaS versionada con OpenAPI 3.0.3 y webhooks firmados.

---

## Características Principales

- **10 Ramos de Seguros Soportados (`data/domains/`)**:
  `autos`, `casco_embarcacion`, `copropiedades`, `cumplimiento`, `equipo_maquinaria`, `hogar`, `pyme`, `salud`, `transporte`, `vida_grupo`.
- **Extracción Multimodal Dual (V1 & V2)**: Procesamiento paralelo de PDFs con modelos Gemini (`gemini-4-hydrogen` por defecto para razonamiento/extracción, `gemini-3.8-flash` para chat y `gemini-3.5-flash-lite` para tareas ligeras) y reconciliación ontológica contra tesauros por ramo.
- **Matriz Unificada de Coberturas**: Comparación lado a lado con virtualización automática (`>150` filas), normalización de deducibles (`parseDeductible`), scoring ponderado y exportación ejecutiva a PDF y Excel (`.xlsx`).
- **Cola Asíncrona y Progreso en Tiempo Real**: Soporte para `Prefer: respond-async` (`HTTP 202`), cola respaldada por Redis/memoria, streaming SSE, polling y cancelación de jobs (`/api/jobs/*`).
- **Chat RAG Triple-Fuente**: Asistente técnico conectado simultáneamente a las cotizaciones analizadas, el clausulado oficial (`documents` / `chunks` con embeddings `gemini-embedding-2` de 3072 dimensiones) y la ontología de coberturas.
- **Portafolio, Clientes y Renovaciones**: Gestión multi-tenant con Row-Level Security (`organizations`, `organization_members`, `client_shares`), seguimiento de renovaciones y automatización de campañas.
- **API Versionada (`/api/v1/*`) & DaaS B2B**: Contrato OpenAPI 3.0.3 servido en `/api/v1/openapi.json`, índices de mercado anonimizados (`/api/v1/daas/*`) y webhooks salientes firmados con HMAC (`/api/v1/webhooks`).

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, jsPDF, ExcelJS |
| **Backend** | Node.js >= 18, Express 5, TypeScript, Pino, Multer, Ajv |
| **IA & RAG** | Google Gemini (`@google/genai`: `gemini-4-hydrogen`, `gemini-3.8-flash`, `gemini-3.5-flash-lite`, `gemini-embedding-2`) |
| **Base de Datos** | Supabase (PostgreSQL + `pgvector` 3072 dims + RLS) |
| **Colas & Rate Limit** | Redis (`ioredis`, `rate-limit-redis`) con fallback en memoria |
| **Testing & Calidad** | Vitest (unit & integration), ESLint, Prettier, Smoke Tests (`bash`) |

---

## Inicio Rápido (Desarrollo Local)

1. **Instalar dependencias desde la raíz**:
   ```bash
   npm install
   ```

2. **Configurar variables de entorno** (`.env` en la raíz / `server/.env`):
   ```env
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
   GEMINI_API_KEY=tu-gemini-api-key

   # Modelos Gemini por defecto (server/src/config/env.ts)
   GEMINI_MODEL=gemini-4-hydrogen
   GEMINI_CHAT_MODEL=gemini-3.8-flash
   GEMINI_FAST_MODEL=gemini-3.5-flash-lite
   GEMINI_EMBEDDING_MODEL=gemini-embedding-2

   # Opcional (recomendado en producción)
   REDIS_URL=redis://localhost:6379
   ```

3. **Levantar backend y frontend** (en dos terminales):
   ```bash
   # Terminal 1: Backend API (puerto 3001 por defecto)
   npm run server:dev

   # Terminal 2: Frontend Vite (puerto 3000 con proxy al backend)
   npm run dev
   ```

Para despliegue en producción (Docker multi-stage, Railway, Redis y migraciones Supabase), consulta [docs/DEPLOY.md](docs/DEPLOY.md).

---

## Endpoints Principales

| Método y Ruta | Descripción |
|---|---|
| `GET /health` | Estado del servicio, Redis y Supabase |
| `GET /api` | Metadatos de la API y rutas disponibles |
| `GET /api/v1/openapi.json` | Especificación OpenAPI 3.0.3 en vivo |
| `POST /api/analysis/*` | Análisis y comparación multimodal de cotizaciones (síncrono o `Prefer: respond-async`) |
| `GET /api/jobs/:id` | Estado, progreso SSE y cancelación de jobs asíncronos |
| `GET /api/documents` | Biblioteca de clausulados y documentos indexados |
| `GET /api/insurers` | Catálogo de aseguradoras y ramos |
| `POST /api/chat` | Chat técnico triple-fuente con streaming |
| `GET /api/portfolio/*` | Clientes, pólizas y delegación multi-tenant |
| `GET /api/renewals/*` | Pipeline de renovaciones y campañas |
| `GET /api/v1/daas/*` | Índices y snapshots de mercado DaaS |
| `GET /api/v1/webhooks` | Suscripciones y entregas de webhooks HMAC |

---

## Scripts de Desarrollo y Verificación

```bash
# Build completo (frontend + backend)
npm run build

# Formato y linting
npm run format:check
npm run lint

# Verificación de tipos
npm run typecheck:frontend
npm run typecheck:backend

# Pruebas unitarias y de integración
npm run test:unit
npm run test:integration

# Smoke tests contra servidor levantado
npm run test:smoke
```

---

## Documentación Relacionada

- [docs/DEPLOY.md](docs/DEPLOY.md) — Guía de despliegue en Railway, Docker y Supabase
- [ARCHITECTURE.md](ARCHITECTURE.md) — Arquitectura técnica del backend y RAG
- [docs/database-description.md](docs/database-description.md) — Inventario de tablas y migraciones (`001`–`037`)
- [docs/openapi.yaml](docs/openapi.yaml) — Contrato OpenAPI 3.0.3 de la API v1
- [docs/daas-openapi.yaml](docs/daas-openapi.yaml) — Contrato OpenAPI del módulo DaaS
- [CONTRIBUTING.md](CONTRIBUTING.md) — Estándares de contribución y flujo de ramas
