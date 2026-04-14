# Spec: Document Upload API

## Capability
Endpoint REST para subir documentos PDF y recibir respuesta inmediata con estado de indexación.

## User Story
**Como** agente de seguros  
**Quiero** subir un PDF de clausulado o cotización  
**Para** que el sistema lo indexe automáticamente y pueda usarlo en comparaciones

## Functional Requirements

### FR-1: Aceptar archivos PDF
- El endpoint debe aceptar multipart/form-data
- Campo requerido: `file` (tipo PDF)
- Tamaño máximo: 50MB
- Validar header de PDF (%PDF-)

### FR-2: Metadata del documento
Campos requeridos:
- `insurerName`: Nombre de la aseguradora (string)
- `documentName`: Nombre descriptivo del documento (string)
- `documentType`: Tipo de documento (enum)
  - `CLAUSULADO_GENERAL`
  - `CLAUSULADO_PARTICULAR`
  - `COTIZACION`

Campos opcionales:
- `version`: Versión del documento (string)
- `uploadedBy`: ID del usuario que sube (string)

### FR-3: Respuesta inmediata
El endpoint debe retornar:
```json
{
  "success": true,
  "documentId": "uuid",
  "insurerId": "uuid",
  "stats": {
    "totalPages": 50,
    "chunksCreated": 150,
    "imagesUploaded": 50,
    "processingTimeMs": 45000
  },
  "warnings": []
}
```

### FR-4: Manejo de errores
Códigos HTTP apropiados:
- `400` - PDF inválido o campos faltantes
- `413` - Archivo muy grande
- `500` - Error interno del servidor
- `429` - Rate limit excedido

## Non-Functional Requirements

### NFR-1: Tiempo de respuesta
- Timeout máximo: 5 minutos
- Respuesta típica: < 2 minutos para PDF de 50 páginas

### NFR-2: Concurrencia
- Procesar un documento a la vez por request
- No implementar cola (futuro)

### NFR-3: Seguridad
- Validar tipo de archivo
- Sanitizar nombres de archivo
- Rate limiting: 10 requests/minuto por IP

## API Specification

### Endpoint
```
POST /api/documents
Content-Type: multipart/form-data
```

### Request Example
```bash
curl -X POST http://localhost:8080/api/documents \
  -F "file=@clausulado.pdf" \
  -F "insurerName=Seguros Bolívar" \
  -F "documentName=Clausulado Modular PYME 2024" \
  -F "documentType=CLAUSULADO_GENERAL" \
  -F "version=1.0"
```

### Success Response (200)
```json
{
  "success": true,
  "documentId": "550e8400-e29b-41d4-a716-446655440000",
  "insurerId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "stats": {
    "totalPages": 50,
    "chunksCreated": 148,
    "imagesUploaded": 50,
    "processingTimeMs": 45678
  },
  "warnings": [
    "Page 3 has minimal extractable text"
  ]
}
```

### Error Response (400)
```json
{
  "success": false,
  "error": "Invalid PDF file",
  "details": "File header does not match PDF format"
}
```

## Validation Rules

1. **File Validation**:
   - Extensión: `.pdf` (case insensitive)
   - Header: debe comenzar con `%PDF-`
   - Tamaño: 1KB - 50MB

2. **Field Validation**:
   - `insurerName`: 1-200 caracteres
   - `documentName`: 1-500 caracteres
   - `documentType`: debe ser uno de los valores del enum

3. **Duplicate Check**:
   - No permitir documento duplicado (misma aseguradora + nombre + tipo)

## Dependencies
- **FR-1** requiere: pdfExtractor (text-extraction spec)
- **FR-2** requiere: documentIndexingService (vector-storage spec)
- **FR-3** requiere: pdfRenderer (page-rendering spec)

## Open Questions
1. ¿Qué hacer si el documento ya existe? ¿Sobrescribir o rechazar?
2. ¿Necesitamos soporte para múltiples archivos simultáneos?
3. ¿Qué información mostrar mientras procesa (progreso)?

## Acceptance Criteria
- [ ] Usuario puede subir PDF válido vía POST /api/documents
- [ ] Sistema valida que es un PDF real
- [ ] Sistema extrae texto y crea chunks automáticamente
- [ ] Respuesta incluye documentId y estadísticas
- [ ] Errores retornan mensajes claros con status code apropiado
- [ ] Rate limiting previene abuso
