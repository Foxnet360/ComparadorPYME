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
- `documentType` (required): Tipo - `CLAUSULADO_GENERAL`, `CLAUSULADO_PARTICULAR`, `COTIZACION`
- `version` (optional): Versión del documento

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

**Response:**
```json
{
  "documents": [
    {
      "id": "uuid",
      "document_name": "Clausulado SOAT",
      "document_type": "CLAUSULADO_GENERAL",
      "insurer_name": "Seguros XYZ"
    }
  ]
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
  -F "documentType=CLAUSULADO_GENERAL"
```

### Buscar:
```bash
curl -X POST http://localhost:8080/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "cobertura total", "limit": 5}'
```
