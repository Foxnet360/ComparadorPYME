## Why

La auditoría de riesgos actual en el Comparador CSA presenta limitaciones críticas que reducen su valor para los corredores de seguros:

1. **Alertas sin fundamento documental**: Las alertas (CRITICAL, WARNING, GOOD) se generan por Gemini sin citar las cláusulas específicas que las fundamentan. Los corredores no pueden defender sus recomendaciones ante clientes o aseguradoras.

2. **Sin análisis contextual**: Las alertas no consideran la naturaleza del negocio del asegurado (manufactura, comercio, servicios) ni los riesgos típicos de cada industria.

3. **Sin comparativa cruzada**: No existe una vista consolidada que muestre qué riesgos afectan a múltiples aseguradoras simultáneamente, dificultando la negociación.

4. **Pobre visualización**: La auditoría se presenta como lista de tarjetas sin jerarquía visual, dashboard ejecutivo ni evidence cards profesionales.

## What Changes

- **Enriquecimiento RAG automático**: Para cada alerta, buscar en la base de datos vectorial (Supabase) chunks de clausulados relevantes usando embeddings
- **Evidence Cards**: Mostrar citas del clausulado con similitud score, página y contexto
- **Dashboard Ejecutivo de Riesgos**: Gráficos de riesgos por aseguradora, comparativa cruzada matricial
- **Análisis Contextual**: Si hay clausulados adjuntos → análisis enriquecido. Si no → análisis técnico basado en datos de cotización + patrones de mercado
- **Botón "Enriquecer"**: Solo visible cuando existen clausulados indexados para las aseguradoras del reporte

## Capabilities

### New Capabilities
- `rag-audit-enrichment`: Búsqueda automática de evidencia en clausulados usando vector similarity
- `risk-dashboard`: Visualización ejecutiva de riesgos con gráficos y comparativas
- `cross-insurer-risk-comparison`: Matriz de riesgos cruzados entre aseguradoras
- `business-context-analysis`: Análisis contextual según naturaleza del negocio

### Modified Capabilities
- `audit-section`: Transformar de lista simple a dashboard profesional enriquecido

## Impact

**Archivos afectados:**
- Backend: `server/src/services/auditEnrichmentService.ts` (nuevo)
- Backend: `server/src/routes/audit.ts` (nuevo endpoint)
- Frontend: `components/AuditSection.tsx` (rediseño completo)
- Frontend: `components/AuditDashboard.tsx` (nuevo)
- Frontend: `components/EvidenceCard.tsx` (nuevo)

**APIs:** Nuevo endpoint `POST /api/audit/enrich`

**Dependencies:** 
- Servicio de embeddings existente
- Supabase con pgvector (ya configurado)
- RAG retrieval service existente

**Sistemas externos:** Supabase (consulta de chunks vectoriales)

**Variables de entorno:** Ninguna nueva

**Breaking changes:** Ninguno. Feature opt-in via botón.
