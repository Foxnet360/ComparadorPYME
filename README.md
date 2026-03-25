<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Comparador CSA - Análisis de Cláusulas de Seguros

Sistema de análisis y comparación de cláusulas de seguros usando IA (Gemini) y búsqueda semántica con Supabase/pgvector.

## Arquitectura

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Base de Datos**: Supabase (PostgreSQL + pgvector)
- **IA**: Google Gemini API (embeddings y análisis)
- **Vector Store**: Supabase pgvector (anteriormente ChromaDB)

## Requisitos Previos

- Node.js 18+
- Cuenta en Supabase
- API Key de Google Gemini

## Configuración Local

### 1. Instalar dependencias

```bash
# Frontend
npm install

# Backend
cd server && npm install
```

### 2. Configurar variables de entorno

Crear archivo `.env` en la raíz y `server/.env`:

```bash
# Supabase
SUPABASE_URL=https://nubiecwypgfekhvaffxm.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
SUPABASE_ANON_KEY=tu_anon_key

# Gemini
GEMINI_API_KEY=tu_gemini_api_key
GEMINI_EMBEDDING_MODEL=gemini-embedding-001

# Configuración Colombia
REGION=CO
SMMLV_VALUE=1300000
UVT_VALUE=42412
CURRENCY=COP
```

### 3. Ejecutar en desarrollo

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

El frontend estará en `http://localhost:3000` y el backend en `http://localhost:8080`.

## Despliegue

### Railway (Recomendado)

1. Push código a GitHub
2. Crear nuevo proyecto en Railway
3. Conectar repositorio
4. Configurar variables de entorno en el dashboard
5. Deploy automático

Ver archivo `railway.json` para configuración de build.

## API Endpoints

- `GET /` - Información de la API
- `GET /health` - Health check
- `POST /api/analyze` - Análisis de documentos
- `POST /api/documents` - Indexar documentos
- `GET /api/documents` - Listar documentos
- `POST /api/search` - Búsqueda semántica
- `POST /api/rag/clauses` - Indexar cláusulas (RAG)
- `POST /api/rag/search` - Búsqueda RAG

## Características

- 📄 Análisis de cotizaciones y clausulados
- 🔍 Búsqueda semántica con embeddings
- 📊 Comparación automática de coberturas
- 💾 Almacenamiento vectorial con Supabase
- 🤖 Análisis impulsado por Gemini AI

## Notas de Migración

**v2.0**: Se migró de ChromaDB a Supabase/pgvector para mejor escalabilidad y compatibilidad con deployment en la nube.
