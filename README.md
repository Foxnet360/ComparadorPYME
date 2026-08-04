# Comparador CSA - Análisis de Cotizaciones de Seguros

Sistema de análisis y comparación de cotizaciones de seguros usando IA (Gemini) y búsqueda semántica con Supabase/pgvector.

## Arquitectura

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Base de Datos**: Supabase (PostgreSQL + pgvector)
- **IA**: Google Gemini API (embeddings y análisis)
- **Vector Store**: Supabase pgvector (anteriormente ChromaDB)

## Nuevas Capacidades (Fases 1-5)

### UX Mejoras (2024)

#### Visor PDF Interactivo
- **Visor integrado**: Visualiza PDFs directamente en la interfaz sin salir del comparador
- **Navegación automática**: Salta directamente a la página de evidencia RAG
- **Resaltado de texto**: Resalta automáticamente el snippet de texto verbatim en el PDF
- **Responsive**: Modo drawer (desktop), modal (tablet), fullscreen (mobile)

#### Correcciones HITL (Human-in-the-Loop)
- **API real conectada**: Las correcciones se guardan en el backend con validación Zod
- **Estado optimista**: La UI se actualiza inmediatamente antes de confirmar con el servidor
- **Cola offline**: Correcciones se guardan localmente cuando no hay conexión y se sincronizan automáticamente
- **Feedback visual**: Estados de pending (spinner), success (check verde), error (reversión)

#### Asistente de Auditoría (Wizard)
- **Panel de discrepancias**: Muestra conteo de discrepancias críticas, advertencias e informativas
- **Navegación inteligente**: Un clic salta a la fila específica de la matriz
- **Progreso de auditoría**: Indicador circular accesible con porcentaje de completitud
- **Agrupación por severidad**: Secciones colapsables para priorizar trabajo

#### Notas Consultivas
- **Editor inline**: Doble-clic en cualquier celda para agregar notas
- **Markdown soportado**: Formato básico con sanitización DOMPurify
- **Persistencia**: Notas se guardan en el estado del reporte
- **Exportación**: Incluidas en exportaciones PDF y Excel

#### Accesibilidad WCAG 2.1 AA
- **Semántica ARIA**: role="grid", role="row", role="gridcell"
- **Navegación por teclado**: Flechas, Enter, Escape, Home, End
- **Anuncios screen reader**: Regiones live para notificaciones y cambios
- **Contraste**: Todos los estilos cumplen con WCAG AA

### Fase 1: Validación de Coberturas
- **Validación bidireccional**: Verifica que coberturas en cotización existan en clausulado (y viceversa)
- **Detección de coberturas fantasma**: Identifica coberturas ofrecidas pero no contempladas en clausulado
- **Scoring obligatorio**: Los clausulados ya no son opcionales; se penaliza su ausencia

### Fase 2: Riesgo de Deducibles + Cobertura Inversa + Versiones
- **Análisis de deducibles**: Calcula deducible real vs suma asegurada, detecta topes
- **Cobertura inversa**: Detecta coberturas obligatorias del clausulado omitidas en cotización
- **Comparación de versiones**: Compara versiones de clausulados para detectar cambios contractuales

### Fase 3: Riesgo Contextualizado + Cumplimiento de Garantías
- **Contextualización por perfil**: Cruzar exclusiones con perfil del cliente (industria, ubicación, etc.)
- **Análisis de garantías**: Clasificar condiciones por tipo (documental/operacional/técnica/financiera)
- **Riesgo de incumplimiento**: Calcular probabilidad de incumplimiento por dificultad

### Fase 4: Abogado Virtual RAG
- **Opiniones legales**: Genera análisis legal personalizado combinando cotización + clausulado + perfil
- **Puntos de negociación**: Identifica puntos específicos de negociación con la aseguradora
- **Citas de clausulado**: Incluye referencias específicas al clausulado como evidencia

### Fase 5: Integración de Análisis Avanzado (Visible)
- **Pestaña "Análisis Avanzado"**: Nueva pestaña condicional que aparece cuando hay datos avanzados
- **Validación de coberturas en Dashboard**: Métricas de verificadas/fantasma/omitidas en tiempo real
- **Riesgo de deducibles visual**: Indicadores LOW/MEDIUM/HIGH por cobertura
- **Opiniones legales visibles**: Tarjetas con análisis legal y puntos de negociación
- **Backward compatible**: Clientes antiguos ignoran campos nuevos sin errores
- **Feature flag controlado**: Rollout gradual via `VITE_ENABLE_ADVANCED_ANALYSIS`

## Requisitos Previos

- Node.js 18+
- Cuenta en Supabase
- API Key de Google Gemini

## Configuración Local

### 1. Instalar dependencias

El proyecto usa un único `package.json` en la raíz para frontend y backend:

```bash
npm install
```

> Nota: `server/package.json` fue eliminado porque el backend comparte dependencias con el frontend y se despliega como monolito en Railway.

### 2. Configurar variables de entorno

Crear archivo `.env` en la raíz del proyecto (no en `server/`):

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

# CORS (opcional, para producción)
CORS_ORIGINS=["https://tudominio.com"]

# Redis (opcional, para learningEngine)
REDIS_URL=redis://localhost:6379
```

**Nota:** El sistema ahora carga `.env` desde la raíz del proyecto. Si usabas `server/.env`, se mantiene como fallback temporal pero está deprecado.

#### Variables de entorno nuevas

- **`CORS_ORIGINS`**: Array JSON de orígenes permitidos para CORS. Ejemplo: `["http://localhost:3000", "https://production.com"]`
- **`REDIS_URL`**: URL de conexión a Redis. Si no está configurada, `learningEngine` se desactiva automáticamente.

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

## Contribuir / Modificar el Proyecto

**IMPORTANTE:** La rama `main` está protegida y despliega automáticamente en Railway. Para hacer modificaciones:

1. **Leer [CONTRIBUTING.md](CONTRIBUTING.md)** - Guía completa del flujo de trabajo
2. **Usar ramas `feature/*`** - Nunca push directo a `main`
3. **Probar localmente** - Antes de integrar a `main`
4. **Seguir el skill** - Usar `.opencode/skills/modificacion/SKILL.md`

### Flujo Rápido

```bash
# 1. Crear rama feature
git checkout -b feature/mi-cambio

# 2. Desarrollar y probar
npm run build
npm start

# 3. Integrar a main
git checkout main
git merge feature/mi-cambio
git push origin main  # Railway deploya automáticamente
```

## Despliegue

### Railway (Recomendado) - Docker Auto-Deploy

Este proyecto usa Docker multi-stage build en Railway. El proceso es completamente automático:

1. **Push código a GitHub** (`git push origin main`)
2. **Railway detecta el cambio** y construye automáticamente
3. **Docker multi-stage build** compila frontend y backend
4. **Deploy automático** sin intervención manual

**No necesitas compilar localmente antes de pushear.** Railway construye todo dentro del contenedor.

#### Configuración inicial

1. Crear nuevo proyecto en Railway
2. Conectar repositorio GitHub
3. Configurar variables de entorno en el dashboard (ver lista completa en `DEPLOY.md`)
4. Railway usará automáticamente el `Dockerfile` de la raíz

#### Variables de entorno requeridas

- `GEMINI_API_KEY` / `VITE_GEMINI_API_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- `GROQ_API_KEY` (opcional)
- `REGION`, `SMMLV_VALUE`, `UVT_VALUE`, `CURRENCY`

Ver `DEPLOY.md` para la guía completa de despliegue y troubleshooting.

### Activar Análisis Avanzado

1. Configurar variable de entorno: `VITE_ENABLE_ADVANCED_ANALYSIS=true`
2. Asegurar que existan clausulados en la base de datos: `npm run seed:clauses`
3. La pestaña "Análisis Avanzado" aparecerá automáticamente cuando hay datos

**Rollback rápido:** Cambiar `VITE_ENABLE_ADVANCED_ANALYSIS=false` y redeploy.

## API Endpoints

- `GET /` - Información de la API
- `GET /health` - Health check extendido (ver abajo)
- `POST /api/analyze` - Análisis de documentos
- `POST /api/documents` - Indexar documentos
- `GET /api/documents` - Listar documentos
- `POST /api/search` - Búsqueda semántica
- `POST /api/rag/clauses` - Indexar cláusulas (RAG)
- `POST /api/rag/search` - Búsqueda RAG

### Health Check Endpoint

`GET /health` ahora reporta el estado de todas las dependencias críticas:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "gemini": { "status": "ok", "latency": 120 },
    "supabase": { "status": "ok", "latency": 45 },
    "redis": { "status": "ok", "latency": 5 }
  }
}
```

**Estados posibles:**
- `healthy` (HTTP 200): Todos los servicios disponibles
- `degraded` (HTTP 503): Algunos servicios no disponibles
- `unhealthy` (HTTP 503): Todos los servicios fallaron

**Caché:** Los resultados se cachean por 30 segundos para evitar llamadas excesivas a APIs externas.

### Formato de Respuestas de Error

Todas las respuestas de error ahora incluyen un formato estandarizado:

```json
{
  "success": false,
  "error": {
    "code": "GEMINI_SERVICE_UNAVAILABLE",
    "message": "Gemini temporalmente no disponible. Reintenta en unos momentos.",
    "requestId": "uuid-v4",
    "retryAfter": 60
  }
}
```

**Campos:**
- `code`: Código de error legible por máquina
- `message`: Mensaje descriptivo en español
- `requestId`: ID de rastreo para soporte
- `retryAfter`: (opcional) Segundos para reintentar

**Códigos de error de Gemini:**
- `GEMINI_RATE_LIMIT` (429): Límite de requests excedido
- `GEMINI_SERVICE_UNAVAILABLE` (503): Servicio temporalmente no disponible
- `GEMINI_TIMEOUT` (504): La extracción tomó demasiado tiempo
- `GEMINI_INVALID_RESPONSE` (502): Respuesta inesperada
- `GEMINI_UNKNOWN_ERROR` (500): Error interno

## Características

- 📄 Análisis de cotizaciones y clausulados
- 🔍 **Matching semántico de coberturas** (4 capas: Thesaurus → Fuzzy → Embeddings → LLM)
- 📊 **Matriz unificada de 14 categorías** canónicas con indicadores de confianza
- 🔍 Búsqueda semántica con embeddings
- 📊 Comparación automática de coberturas
- 💾 Almacenamiento vectorial con Supabase
- 🤖 Análisis impulsado por Gemini AI

## Pipeline de Extracción (v2.1)

El sistema utiliza un pipeline de extracción de dos capas para máxima confiabilidad:

### 1. Extracción Estructurada (JSON Mode)
- **Tecnología**: Gemini 2.5 Flash con `responseMimeType: application/json`
- **Schema**: Tipado estricto con los 14 nombres canónicos de coberturas PYME
- **Confianza**: > 90% para extracciones exitosas
- **Fallback**: Automático a extracción de texto si JSON mode falla

### 2. Validación de Negocio
- Validación de rangos de prima (100K - 500M COP)
- Verificación de coberturas obligatorias (14 PYME)
- Validación de formatos de deducibles
- Consistencia entre campos relacionados

### 3. Scoring de Confianza
- **Cobertura**: 30% - Ratio de coberturas presentes
- **Números**: 25% - Parseo exitoso de valores
- **Validación**: 25% - Aprobación de reglas de negocio
- **Schema**: 20% - Conformidad con estructura JSON

### Umbrales
- >= 90: Confianza Alta (verde)
- >= 75: Confianza Media (amarillo) - Revisión recomendada
- >= 50: Confianza Baja (naranja) - Revisión necesaria
- < 50: Crítica (rojo) - No usar para scoring automático

## Sistema de Matching Semántico de Coberturas (v2.2)

El sistema implementa un matching semántico de 4 capas para unificar coberturas equivalentes bajo 14 categorías canónicas de la Plantilla PYME.

### Arquitectura de Matching

```
Cobertura Extraída → Capa 1: Thesaurus → Capa 2: Fuzzy → Capa 3: Embedding → Capa 4: LLM
                          ↑
                    [Confianza >= 0.6]
```

### Las 4 Capas

#### Capa 1: Thesaurus Exacto
- **Método**: Coincidencia exacta con sinónimos predefinidos
- **Confianza**: 1.0 (exacta), 0.95 (parcial)
- **Cobertura**: ~80% de casos
- **Performance**: Instantáneo

#### Capa 2: Fuzzy Matching (Levenshtein)
- **Método**: Distancia de edición normalizada
- **Umbral**: >= 0.6
- **Cobertura**: ~15% de casos
- **Casos**: Errores tipográficos, variantes de escritura

#### Capa 3: Embedding Similarity
- **Método**: Similitud coseno entre embeddings
- **Umbral**: >= 0.7
- **Cobertura**: ~4% de casos
- **Casos**: Sinónimos semánticos no en thesaurus
- **Cache**: Embeddings precalculados para las 14 categorías

#### Capa 4: LLM Fallback
- **Método**: Clasificación con Gemini
- **Umbral**: >= 0.6
- **Cobertura**: ~1% de casos
- **Casos**: Coberturas ambiguas o no estándar
- **Timeout**: 2 segundos por cobertura

### Categorías Canónicas (14)

1. Incendio (Edificio y Contenidos)
2. Lucro Cesante
3. Sustracción / Hurto
4. Equipo Eléctrico y Electrónico
5. Rotura de Maquinaria
6. Responsabilidad Civil (RCE)
7. Vidrios Planos
8. Manejo Global / Infidelidad
9. Transporte de Mercancías
10. Transporte de Valores
11. Asistencia PYME
12. Asistencia Legal
13. Huelga, Motín, Asonada (HMACC)
14. Terremoto y Eventos Catastróficos

### Contrato de API

Cada cobertura en la respuesta incluye campos de mapeo semántico:

```typescript
interface CoverageItem {
  name: string;                    // Nombre original extraído
  value: string;                   // Valor asegurado
  deductible?: string;             // Deducible
  canonicalName?: string;          // Nombre canónico de la categoría
  categoryId?: number | null;      // ID de categoría (1-14)
  matchConfidence?: number;        // Confianza del match (0-1)
  matchMethod?: 'thesaurus' | 'fuzzy' | 'embedding' | 'llm' | null;
}
```

### Indicadores Visuales

- 🟢 **Verde** (>= 0.9): Match exacto o altamente confiable
- 🟡 **Amarillo** (0.7-0.89): Match aproximado, revisar
- 🔴 **Rojo** (< 0.7): Match con baja confianza
- ⚪ **Gris**: Cobertura no incluida en la cotización

### Performance

- **Thesaurus**: < 1ms por cobertura
- **Fuzzy**: < 5ms por cobertura
- **Embedding**: ~100ms por cobertura (con cache)
- **LLM**: ~500-2000ms por cobertura
- **Total**: < 5 segundos para 15 coberturas

## Guía de Troubleshooting

### Problemas de Extracción

#### 1. JSON Malformado / "Unterminated string in JSON"

**Síntoma**: Error al parsear respuesta de Gemini: `SyntaxError: Unterminated string in JSON`

**Causas comunes**:
- PDFs muy grandes (>10 páginas) que exceden el contexto de Gemini
- Tablas de coberturas muy extensas
- Formato mixto de texto y tablas

**Solución**:
- El sistema automáticamente intenta reparar el JSON (cierra strings, elimina trailing commas)
- Si la reparación falla, hace fallback a extracción de texto
- Para PDFs complejos, el pre-procesador detecta complejidad y extrae solo secciones relevantes

#### 2. Números Colombianos Mal Interpretados

**Síntoma**: Prima de `$8.500.000` extraída como `$8.5` o `$8500000.0` incorrecto

**Causa**: Confusión entre formato colombiano (`1.234.567,89`) e internacional (`1,234,567.89`)

**Solución**:
- El pre-procesador normaliza automáticamente: `1.234.567,89` → `1234567.89`
- Si ves este problema, verifica que `textPreprocessor.ts` está ejecutándose antes de Gemini
- Patrón regex usado: `/\d{1,3}(?:\.\d{3})+(?:,\d{2})/g`

#### 3. Nombres de Coberturas No Mapeados

**Síntoma**: Cobertura aparece con nombre original (ej: "Amparo Básico de RC") en lugar del canónico ("Responsabilidad Civil Extracontractual")

**Causas**:
- El nombre no existe en el tesauro (`tesauro(pyme).md`)
- Similitud < 0.7 con cualquier variante conocida

**Solución**:
- Verificar que el tesauro está cargado: revisar logs por `[Thesaurus] Loaded X entries`
- Agregar la variante al tesauro en la sección correspondiente
- Para mapeos inciertos (similitud 0.6-0.7), el sistema marca `needsReview: true`

#### 4. Prima No Detectada (priceAnnual = 0)

**Síntoma**: Extracción exitosa pero `priceAnnual` es 0 o null

**Causas**:
- La prima está en una sección separada del PDF (ej: página de resumen)
- Formato inusual: "TOTAL A PAGAR", "VALOR TOTAL", "TARIFA"

**Solución**:
- El sistema ahora tiene 3 estrategias de extracción de prima:
  1. Extracción estructurada (JSON mode)
  2. Fallback regex: busca patrones como `prima.*?\d[\d.,]+`
  3. Retry con prompt enfocado en prima
- Si ninguna funciona, el scoring de confianza se reduce en 25 puntos

#### 5. Deducibles en Formato No Estándar

**Síntoma**: Deducible mostrado como "No aplica Deducible" o "10% Valor Asegurado + 1 SMMLV"

**Solución**:
- El normalizador de deducibles maneja:
  - `"No aplica Deducible"` → `"No aplica"`
  - `"10% VA + 1 SMMLV"` → `"10% + 1 SMMLV"`
  - `"Sin deducible"` → `"No aplica"`
- Ver `deductiblePatterns` en `thesaurusMapper.ts` para patrones soportados

#### 6. PDFs Escaneados / Imágenes

**Síntoma**: Extracción devuelve texto vacío o basura

**Causa**: El PDF es una imagen escaneada, no texto seleccionable

**Solución**:
- Este sistema **no soporta OCR** (es un non-goal)
- Convertir el PDF a texto usando OCR externo (Adobe Acrobat, Tesseract) antes de subir
- Verificar que el PDF tiene texto seleccionable: abrir en lector de PDF e intentar copiar texto

#### 7. Errores de Codificación (Caracteres Raros)

**Síntoma**: Texto muestra `CotizaciÃ³n` en lugar de `Cotización`

**Causa**: Problema de encoding UTF-8 en el PDF

**Solución**:
- El pre-procesador corrige automáticamente artefactos comunes:
  - `Ã¡` → `á`, `Ã©` → `é`, `Ã­` → `í`, `Ã³` → `ó`, `Ãº` → `ú`
  - `Ã±` → `ñ`, `Ã‘` → `Ñ`
  - `Â¿` → `¿`, `Â¡` → `¡`
- Si persiste, verificar encoding del PDF con `pdfinfo` o similar

### Debugging

#### Ver Logs de Extracción

```bash
# Backend en modo debug
DEBUG=extractor:* npm run dev

# O ver logs específicos
grep -E "(extractor|preprocessor|thesaurus|repair)" server/logs/app.log
```

#### Métricas de Extracción

Cada extracción genera metadata:

```typescript
{
  preprocessingDuration: 45,      // ms
  complexity: "medium",           // simple | medium | complex
  repairAttempts: 1,              // 0 si no fue necesario
  thesaurusMappings: 12,          // coberturas mapeadas
  thesaurusFailures: 2,           // coberturas no mapeadas
  confidence: 87,                 // 0-100
  premiumSource: "structured"     // structured | regex_fallback | prompt_retry
}
```

### Checklist de Verificación

- [ ] Gemini API key válida y con crédito
- [ ] Supabase conectado y tabla `documents` accesible
- [ ] Archivo `tesauro(pyme).md` existe en raíz del proyecto
- [ ] Variables de entorno configuradas: `SMMLV_VALUE`, `UVT_VALUE`
- [ ] PDF tiene texto seleccionable (no escaneado)
- [ ] PDF < 50MB y < 100 páginas (límites de Gemini)

## Formato de Extensiones del Tesauro

El sistema soporta extensiones del tesauro mediante el archivo `tesauro-extensiones.md` (opcional).

### Propósito

Las extensiones permiten agregar coberturas adicionales sin modificar el tesauro principal:
- **Sub-límites**: Remoción de Escombros, Honorarios Profesionales, Gastos de Extinción
- **Extensiones**: Amparo Automático, Bienes en Ferias, Equipos de Reemplazo
- **Riders**: Coberturas adicionales específicas por aseguradora

### Formato

```markdown
## Extensiones de Tesauro

| Concepto Estándar | Variantes | Tipo | Cobertura Padre |
|---|---|---|---|
| **Remoción de Escombros** | Remoción, Escombros, Limpieza | sub-limit | Incendio |
| **Honorarios Profesionales** | Honorarios, Arquitectos, Ingenieros | sub-limit | Incendio |
| **Amparo Automático** | Amparo Auto, Extensión Automática | rider | Incendio |
| **Bienes en Ferias** | Ferias, Exposiciones, Bienes Fuera | rider | Incendio |
```

### Campos

- **Concepto Estándar**: Nombre canónico (en negritas)
- **Variantes**: Lista separada por comas de nombres que usa cada aseguradora
- **Tipo**: `main` | `sub-limit` | `rider` | `gastos` | `extension`
- **Cobertura Padre**: Nombre canónico de la cobertura principal (solo para sub-límites y riders)

### Umbrales de Confianza

- **Coberturas principales**: >= 0.7 (70%)
- **Sub-límites y riders**: >= 0.6 (60%)

### Ejemplo de Uso

Cuando el sistema encuentra `"Remoción de Escombros"` en una cotización:
1. Busca en el tesauro principal (no encuentra coincidencia exacta)
2. Busca en extensiones → encuentra match con 95% confianza
3. Mapea a: `canonicalName: "Remoción de Escombros"`, `type: "sub-limit"`, `parentCoverage: "Incendio"`
4. El scoring de confianza aplica umbrales diferenciados según el tipo

### Agregar Nuevas Extensiones

1. Crear/editar `tesauro-extensiones.md` en la raíz del proyecto
2. Seguir el formato de tabla markdown
3. Reiniciar el servidor para recargar
4. Verificar en logs: `[Thesaurus] Loaded X extension entries`

## Extracción Multimodal (Nuevo en v3.0)

### Pipeline de Extracción con Visión de PDF

El sistema ahora soporta extracción multimodal usando Gemini 2.5 Pro con visión de documentos:

```
PDF → Gemini File API → Visión Multimodal → Schema V2 → Normalización → 14 Coberturas Canónicas
```

**Ventajas sobre extracción de texto:**
- Preserva estructura tabular (no destruye tablas como pdfjs-dist)
- Detecta automáticamente el formato del documento (6 familias)
- Usa prompts especializados por tipo de layout
- Extrae primas por cobertura individual
- Separa sub-límites de coberturas principales

### Familias de Formato Soportadas

| Familia | Aseguradoras Ejemplo | Características |
|---------|---------------------|----------------|
| **TABLE-DOUBLE** | HDI | Coberturas y deducibles en tablas separadas |
| **TABLE-INTEGRATED** | CHUBB | Todo en una tabla con sub-límites |
| **SECTIONS** | MAPFRE | Secciones numeradas con coberturas implícitas |
| **DESCRIPTIVE** | AXA | Texto descriptivo extenso por cobertura |
| **PRICE-TABLE** | SBS | Primas individuales por cobertura |
| **TEXT** | BOLÍVAR | Texto corrido/carta sin tabla definida |

### Activar Extracción Multimodal

```bash
# Backend
export ENABLE_MULTIMODAL_EXTRACTION=true

# Frontend (build time)
export VITE_ENABLE_MULTIMODAL_EXTRACTION=true
```

### Feature Flag

El sistema usa dual pipeline:
- **Multimodal (V2)**: Cuando `ENABLE_MULTIMODAL_EXTRACTION=true`
- **Legacy (V1)**: Fallback automático si V2 falla o flag está desactivado

### Schema V2 vs V1

**Schema V1 (Legacy):**
- Forzaba 14 coberturas canónicas
- Valores inventados cuando no existían en PDF
- Un solo prompt genérico

**Schema V2 (Multimodal):**
- Extrae coberturas crudas como aparecen en el PDF
- Captura sub-límites, deducibles generales, bienes asegurables
- Primas desglosadas (neta, gastos, IVA, otros, total)
- Post-normalización inteligente a 14 canónicas

### Performance

| Métrica | V1 (Legacy) | V2 (Multimodal) |
|---------|-------------|-----------------|
| Tiempo por quote | ~2.4 min | ~1-2 min |
| Precisión primas | ~70% | >90% |
| Precisión coberturas | ~60% | >85% |
| Precisión deducibles | ~50% | >80% |
| Valores inventados | Sí | No |
| Primas por cobertura | No | Sí |

### Arquitectura de Servicios

```
┌─────────────────────────────────────────────────────────┐
│  formatDetector.ts     → Detecta familia de formato     │
│  promptBuilder.ts      → Prompt especializado           │
│  gemini.ts             → File API + visión multimodal   │
│  coverageNormalizer.ts → Mapeo a 14 canónicas           │
│  premiumExtractor.ts   → Desglose de primas             │
└─────────────────────────────────────────────────────────┘
```

## Notas de Migración

**v3.0**: Pipeline de extracción multimodal con visión de PDFs, detección de formato familiar, y schema flexible V2.
**v2.2**: Mejoras en extracción de secciones, parsing de primas, y expansiones del tesauro.
**v2.1**: Pipeline de extracción mejorado con JSON mode, validación de negocio, y scoring de confianza.
**v2.0**: Se migró de ChromaDB a Supabase/pgvector para mejor escalabilidad y compatibilidad con deployment en la nube.
