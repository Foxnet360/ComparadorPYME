# API de Correcciones Extendida

## POST /api/analysis/correction

Guarda una corrección de usuario para retroalimentar el motor de aprendizaje.

### Request Body

```json
{
  "correctionId": "string (opcional) - UUID para idempotencia",
  "rawName": "string (requerido) - Nombre original de la cobertura",
  "insurerName": "string (requerido) - Nombre de la aseguradora",
  "systemMapping": "string (requerido) - Mapeo actual del sistema",
  "userCorrection": "string (requerido) - Corrección del usuario",
  "correctionType": "string (opcional) - Tipo: 'coverage_mapping' | 'deductible' | 'exclusion' | 'value' (default: 'coverage_mapping')",
  "quoteId": "string (opcional) - ID de la cotización",
  "rawTextSnippet": "string (opcional, max 2000 chars) - Fragmento de texto del PDF",
  "aiJustification": "string (opcional, max 2000 chars) - Justificación de la IA",
  "pageNumber": "number (opcional) - Número de página en el PDF"
}
```

### Response

**Success (200)**
```json
{
  "id": "string - ID de la corrección guardada",
  "success": true
}
```

**Cached Response (200)**
```json
{
  "id": "string",
  "success": true,
  "cached": true
}
```

**Validation Error (400)**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "rawName",
      "message": "El nombre raw es requerido"
    }
  ]
}
```

**Server Error (500)**
```json
{
  "error": "Internal server error while saving correction",
  "details": "string"
}
```

### Idempotencia

Si se proporciona un `correctionId`, el sistema verifica si ya existe una corrección con ese ID. Si existe, retorna la corrección existente sin crear una nueva.

### Campos Extendidos

Los campos `rawTextSnippet`, `aiJustification`, y `pageNumber` son opcionales y se utilizan para:
- Proveer evidencia textual del PDF para contexto
- Guardar la justificación generada por la IA
- Registrar la página de origen en el documento

### Flujo de Aprendizaje

1. Usuario envía corrección
2. Sistema valida payload con Zod
3. Verifica idempotencia (si correctionId existe)
4. Guarda en tabla `coverage_mappings`
5. Actualiza tesauro con nuevo sinónimo
6. Actualiza embeddings (si es corrección de cobertura)
7. Invalida caché afectada
8. Actualiza ontología

### Ejemplo de Uso

```typescript
const correction = {
  rawName: "Incendio Edificio",
  insurerName: "Seguros Mundial",
  systemMapping: "Incendio (Edificio y Contenidos)",
  userCorrection: "Incendio (Edificio y Contenidos)",
  correctionType: "coverage_mapping",
  rawTextSnippet: "El asegurador cubre daños por incendio",
  pageNumber: 3
};

const response = await fetch('/api/analysis/correction', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(correction)
});
```

## POST /api/analysis/:id/export

Exporta el análisis a Excel con opción de incluir notas consultivas.

### Request Body (opcional)

```json
{
  "cellNotes": {
    "cellId1": "Nota consultiva para celda 1",
    "cellId2": "Nota consultiva para celda 2"
  }
}
```

### Response

Archivo Excel (.xlsx) para descarga.

### Ejemplo de Uso

```typescript
const cellNotes = {
  "coverage-Incendio (Edificio y Contenidos)": "Ojo: Aunque BBVA es más barato, esta prima excluye daños por granizo"
};

const response = await fetch(`/api/analysis/${analysisId}/export`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ cellNotes })
});

const blob = await response.blob();
// Descargar archivo...
```
