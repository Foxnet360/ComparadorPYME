# API Documentation - CSA Comparator

## Base URL

Desarrollo: `http://localhost:8080`
Producción: `https://your-app.railway.app`

## Endpoints

### Health Check

**GET** `/health`

**Response:**
```json
{
  "status": "ok",
  "message": "CSA Comparator API is running",
  "timestamp": "2026-03-25T20:00:00.000Z"
}
```

### Document Management

#### Upload Document
**POST** `/api/documents`

**Content-Type:** `multipart/form-data`

**Parameters:**
- `file` (required): Archivo PDF
- `insurerName` (required): Nombre de la aseguradora
- `documentName` (required): Nombre del documento
- `documentType` (required): Tipo - `CLAUSULADO_GENERAL`, `CLAUSULADO_PARTICULAR`, `COTIZACION`, `ANEXO`
- `productName` (optional): Nombre del producto/ramo (ej: "Póliza PYME")
- `version` (optional): Versión del documento (ej: "2024.1")

**Response:**
```json
{
  "success": true,
  "documentId": "uuid",
  "message": "Document indexed successfully"
}
```

#### List Documents
**GET** `/api/documents`

**Query Parameters:**
- `insurerId` (optional): Filtrar por aseguradora
- `documentType` (optional): Filtrar por tipo
- `isActive` (optional): `true` o `false` - filtrar por estado
- `latest` (optional): `true` - solo última versión activa por combinación
- `limit` (optional): Número máximo de resultados (default: 50)
- `offset` (optional): Paginación (default: 0)

**Response:**
```json
{
  "documents": [
    {
      "id": "uuid",
      "documentName": "Clausulado SOAT",
      "documentType": "CLAUSULADO_GENERAL",
      "version": "2024.1",
      "productName": "Póliza PYME",
      "isActive": true,
      "insurer": {
        "id": "uuid",
        "name": "Seguros XYZ"
      }
    }
  ],
  "count": 1,
  "total": null
}
```

#### Get Document
**GET** `/api/documents/:id`

**Response:** Document details with metadata

#### Delete Document
**DELETE** `/api/documents/:id`

**Response:**
```json
{
  "success": true,
  "message": "Document deleted"
}
```

#### Get Document Chunks
**GET** `/api/documents/:id/chunks`

**Response:** Array of chunks with embeddings

### Versionado de Documentos

El sistema implementa versionado automático basado en la combinación única de:
- `insurer_id` + `document_type` + `product_name`

**Comportamiento:**
- Al subir un nuevo documento con la misma combinación, la versión anterior se archiva automáticamente (`is_active = false`)
- Solo puede haber una versión activa por combinación
- Las versiones archivadas se mantienen en la base de datos pero se excluyen de búsquedas por defecto

**Ejemplo de flujo:**
1. Subir v2024.1 → Documento activo
2. Subir v2024.2 → v2024.1 se archiva automáticamente, v2024.2 activo

### Search

#### Semantic Search
**POST** `/api/search`

**Body:**
```json
{
  "query": "cobertura de daños",
  "insurerId": "uuid",
  "coverageTag": "danos",
  "limit": 10
}
```

**Response:**
```json
{
  "success": true,
  "query": "cobertura de daños",
  "results": [
    {
      "chunkId": "uuid",
      "content": "texto del chunk...",
      "similarity": 0.89,
      "pageNumber": 5,
      "documentName": "Clausulado SOAT"
    }
  ]
}
```

### Analysis

#### Analyze Quote
**POST** `/api/analyze`

**Content-Type:** `multipart/form-data`

**Parameters:**
- `quotes` (required): Archivo(s) PDF de cotización
- `clauses` (optional): Archivo(s) PDF de clausulado

**Response:** Análisis completo con comparación

#### Get History
**GET** `/api/history?userId=test`

**Response:** Historial de análisis

## Códigos de Error

- `400` - Bad Request (datos inválidos)
- `404` - Not Found (recurso no existe)
- `500` - Internal Server Error

## Ejemplos cURL

### Subir documento:
```bash
curl -X POST http://localhost:8080/api/documents \
  -F "file=@clausulado.pdf" \
  -F "insurerName=Seguros XYZ" \
  -F "documentName=Clausulado 2024" \
  -F "documentType=CLAUSULADO_GENERAL" \
  -F "productName=Póliza PYME" \
  -F "version=2024.1"
```

### Listar documentos activos:
```bash
curl "http://localhost:8080/api/documents?isActive=true"
```

### Ver últimas versiones:
```bash
curl "http://localhost:8080/api/documents?latest=true"
```

### Buscar:
```bash
curl -X POST http://localhost:8080/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "cobertura total", "limit": 5}'
```
