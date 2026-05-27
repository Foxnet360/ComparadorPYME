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

```json
{
  "quotes": [
    {
      "insurerName": "Seguros Bolívar",
      "policyName": "Empresarial Plus",
      "priceAnnual": 8500000,
      "currency": "COP",
      "score": 85,
      "coverages": [...],
      "alerts": [...],
      "clauseValidation": {
        "hasClauseDocument": true,
        "verifiedCount": 12,
        "phantomCount": 1,
        "mandatoryMissingCount": 0,
        "optionalMissingCount": 0,
        "scoreImpact": 0
      },
      "deductibleAnalysis": [
        {
          "coverage": "Incendio",
          "level": "MEDIUM",
          "riskScore": 65
        }
      ],
      "contextualRisk": {
        "businessType": "Retail",
        "risks": ["Robo nocturno"]
      },
      "warrantyCompliance": {
        "compliant": true,
        "violations": []
      },
      "legalOpinion": [
        {
          "title": "Opinión RC",
          "text": "Cobertura adecuada..."
        }
      ]
    }
  ],
  "recommendation": "Mejor opción: Seguros Bolívar con score de 85/100...",
  "marketAnalysis": "Se analizaron 2 cotizaciones...",
  "deductibleComparison": [...],
  "timestamp": "2026-05-06T11:00:00.000Z",
  "analysisVersion": "2.0-rag"
}
```

**Campos nuevos (opcionales - backward compatible):**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `clauseValidation` | object | Validación de coberturas contra clausulado |
| `clauseValidation.hasClauseDocument` | boolean | Si existe clausulado para la aseguradora |
| `clauseValidation.verifiedCount` | number | Coberturas verificadas en clausulado |
| `clauseValidation.phantomCount` | number | Coberturas "fantasma" (ofrecidas pero no en clausulado) |
| `clauseValidation.mandatoryMissingCount` | number | Coberturas obligatorias omitidas |
| `clauseValidation.optionalMissingCount` | number | Coberturas opcionales omitidas |
| `deductibleAnalysis` | array | Análisis de riesgo por deducible |
| `deductibleAnalysis[].coverage` | string | Nombre de la cobertura |
| `deductibleAnalysis[].level` | string | Nivel de riesgo: LOW, MEDIUM, HIGH |
| `deductibleAnalysis[].riskScore` | number | Puntaje de riesgo (0-100) |
| `contextualRisk` | object | Riesgos contextualizados por perfil del cliente |
| `warrantyCompliance` | object | Cumplimiento de garantías y condiciones |
| `legalOpinion` | array | Opiniones legales generadas por IA |

**Nota:** Los campos nuevos solo aparecen cuando `VITE_ENABLE_ADVANCED_ANALYSIS=true` y existen datos de análisis avanzado. Clientes antiguos pueden ignorarlos sin problemas.

#### Get History
**GET** `/api/history?userId=test`

**Response:** Historial de análisis

### Analysis Endpoints (New)

#### Validate Coverages
**POST** `/api/analysis/validate-coverages`

**Content-Type:** `application/json`

**Body:**
```json
{
  "quote": {
    "insurerName": "Seguros Bolívar",
    "coverages": [
      { "name": "Incendio", "value": "500M", "deductible": "10%" }
    ]
  },
  "insurerName": "Seguros Bolívar"
}
```

**Response:**
```json
{
  "results": [
    {
      "coverageName": "Incendio",
      "status": "VERIFIED",
      "existsInClause": true
    }
  ],
  "phantomCount": 0,
  "mandatoryMissingCount": 0,
  "scoreImpact": 0
}
```

#### Analyze Deductible Risk
**POST** `/api/analysis/deductible-risk`

**Body:**
```json
{
  "coverageName": "Incendio",
  "quoteDeductible": "10%",
  "clauseDeductible": "10% / Máx. 500 SMMLV",
  "insuredAmount": 500000000
}
```

**Response:**
```json
{
  "coverageName": "Incendio",
  "deductibleAmount": 50000000,
  "deductibleRatio": 0.10,
  "riskLevel": "LOW",
  "score": 85,
  "hasCap": true,
  "capAmount": 650000000
}
```

#### Inverse Coverage Check
**POST** `/api/analysis/inverse-check`

**Body:**
```json
{
  "quote": { "coverages": [...] },
  "insurerName": "Seguros Bolívar"
}
```

**Response:**
```json
{
  "results": [
    {
      "coverageName": "Responsabilidad Civil",
      "status": "MANDATORY_MISSING",
      "alertLevel": "CRITICAL"
    }
  ],
  "mandatoryMissingCount": 1
}
```

#### Contextualize Exclusions
**POST** `/api/analysis/contextualize`

**Body:**
```json
{
  "exclusions": ["No cubre inundación en zonas costeras"],
  "clientProfile": {
    "industryType": "manufactura",
    "locationZone": "costera",
    "locationCity": "Cartagena"
  }
}
```

**Response:**
```json
{
  "exclusions": [
    {
      "exclusion": "No cubre inundación en zonas costeras",
      "contextualRiskLevel": "CRITICAL",
      "explanation": "El cliente está en zona costera...",
      "mitigationSuggestions": ["Contratar cobertura adicional"]
    }
  ],
  "criticalCount": 1
}
```

#### Warranty Compliance Analysis
**POST** `/api/analysis/warranty-compliance`

**Body:**
```json
{
  "conditions": ["Mantener sistema de alarma 24/7", "Fianza del 20%"],
  "clientProfile": { "employeeCount": 50, "annualRevenue": 1000000000 }
}
```

**Response:**
```json
{
  "totalConditions": 2,
  "byType": {
    "operacional": { "count": 1, "compliant": 1, "risk": "LOW" },
    "financiero": { "count": 1, "compliant": 0, "risk": "HIGH" }
  },
  "overallRisk": "HIGH",
  "compliancePercentage": 50
}
```

#### Generate Legal Opinion
**POST** `/api/analysis/legal-opinion`

**Body:**
```json
{
  "quote": {
    "insurerName": "Seguros Bolívar",
    "coverageName": "Responsabilidad Civil",
    "value": "500M",
    "deductible": "5%"
  },
  "clientProfile": { "industryType": "manufactura", "employeeCount": 150 },
  "insurerName": "Seguros Bolívar"
}
```

**Response:**
```json
{
  "coverageName": "Responsabilidad Civil",
  "riskScenario": "Para un manufacturero con 150 empleados...",
  "recommendation": "El límite de RC de $500M puede ser insuficiente...",
  "negotiationPoints": [
    {
      "point": "Aumentar límite de RC a $1.000M",
      "priority": "HIGH"
    }
  ],
  "confidence": 85
}
```

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

## Unified Comparison Engine (New)

### Unified Comparison

**POST** `/api/comparison/unified`

Compare multiple insurance quotes using the unified engine.

**Content-Type:** `multipart/form-data`

**Parameters:**
- `quotes` (required): Array of PDF files (2-10 files)
- `userId` (optional): User ID for tracking
- `clientName` (optional): Client name for the analysis

**Response:**
```json
{
  "quotes": [
    {
      "insurerName": "Seguros Bolívar",
      "score": 85,
      "coverages": [...],
      "alerts": [...]
    }
  ],
  "recommendation": "Mejor opción: Seguros Bolívar con score de 85/100",
  "marketAnalysis": "Se analizaron 3 cotizaciones..."
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/api/comparison/unified \
  -F "quotes=@quote1.pdf" \
  -F "quotes=@quote2.pdf" \
  -F "quotes=@quote3.pdf" \
  -F "clientName=ACME Corp"
```

### Deep Mode Validation

**POST** `/api/comparison/:id/deep-mode`

Validate comparison results against clause documents.

**Content-Type:** `multipart/form-data`

**Parameters:**
- `id` (path): Comparison ID
- `clauses` (required): Array of clause PDF files
- `userId` (optional): User ID

**Response:**
```json
{
  "originalComparison": { ... },
  "validatedComparison": { ... },
  "validations": [
    {
      "insurer": "Seguros Bolívar",
      "coverage": "INCENDIO",
      "field": "deductible",
      "originalValue": "10% - Ver condiciones",
      "validatedValue": "10% - Mínimo 1 SMMLV",
      "source": "página 15"
    }
  ],
  "discrepancies": [
    {
      "insurer": "MAPFRE",
      "type": "exclusion",
      "description": "No cubre terremoto",
      "severity": "high"
    }
  ]
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/api/comparison/123/deep-mode \
  -F "clauses=@clause1.pdf" \
  -F "clauses=@clause2.pdf"
```

## Monitoring Endpoints

### Get Unified Engine Metrics

**GET** `/api/monitoring/unified-engine`

**Query Parameters:**
- `days` (optional): Number of days to include (default: 7)

**Response:**
```json
{
  "period": {
    "since": "2024-01-01T00:00:00Z",
    "until": "2024-01-31T23:59:59Z"
  },
  "metrics": {
    "total": 150,
    "unified": 135,
    "legacy": 10,
    "fallback": 5,
    "successRate": 96,
    "fallbackRate": 3,
    "avgProcessingTimeMs": 45000,
    "avgConfidenceScore": 85
  }
}
```

### Get Engine Comparison

**GET** `/api/monitoring/engine-comparison`

**Query Parameters:**
- `start` (optional): Start date (ISO 8601)
- `end` (optional): End date (ISO 8601)

**Response:**
```json
{
  "period": { "start": "2024-01-01", "end": "2024-01-31" },
  "metrics": {
    "unified": {
      "count": 135,
      "avgProcessingTime": 45000,
      "avgConfidence": 85,
      "successRate": 96
    },
    "legacy": {
      "count": 10,
      "avgProcessingTime": 180000,
      "avgConfidence": 75
    },
    "fallback": {
      "count": 5,
      "rate": 3,
      "topReasons": ["Timeout", "Parse error"]
    }
  }
}
```

### Get Active Alerts

**GET** `/api/monitoring/alerts`

**Response:**
```json
{
  "alerts": [
    {
      "id": "fallback-2024-01-15",
      "type": "fallback_rate",
      "severity": "warning",
      "message": "High fallback rate detected: 8%",
      "details": { ... },
      "timestamp": "2024-01-15T10:30:00Z",
      "acknowledged": false
    }
  ],
  "count": 1
}
```

### Acknowledge Alert

**POST** `/api/monitoring/alerts/:id/acknowledge`

**Response:**
```json
{
  "success": true,
  "message": "Alert fallback-2024-01-15 acknowledged"
}
```

### Get Error Tracking

**GET** `/api/monitoring/errors`

**Query Parameters:**
- `start` (optional): Start date
- `end` (optional): End date
- `category` (optional): Error category filter

**Response:**
```json
{
  "period": { "start": "2024-01-01", "end": "2024-01-31" },
  "summary": {
    "total": 25,
    "byCategory": {
      "gemini_api": 10,
      "pdf_upload": 5,
      "json_parse": 3,
      "timeout": 7
    },
    "topErrors": [
      {
        "message": "Service unavailable",
        "count": 8,
        "category": "gemini_api"
      }
    ],
    "resolutionRate": 80
  }
}
```

### Resolve Error

**POST** `/api/monitoring/errors/:id/resolve`

**Body:**
```json
{
  "resolution": "Fixed by increasing timeout"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Error 123 resolved"
}
```

### Get Alerting Configuration

**GET** `/api/monitoring/alerts/config`

**Response:**
```json
{
  "config": {
    "fallbackRateThreshold": 5,
    "processingTimeThreshold": 120000,
    "errorRateThreshold": 10,
    "checkIntervalMinutes": 15,
    "alertCooldownMinutes": 60
  }
}
```

### Update Alerting Configuration

**PUT** `/api/monitoring/alerts/config`

**Body:**
```json
{
  "fallbackRateThreshold": 3,
  "processingTimeThreshold": 90000,
  "errorRateThreshold": 5,
  "checkIntervalMinutes": 10,
  "alertCooldownMinutes": 30
}
```

**Response:**
```json
{
  "success": true,
  "config": {
    "fallbackRateThreshold": 3,
    "processingTimeThreshold": 90000,
    "errorRateThreshold": 5,
    "checkIntervalMinutes": 10,
    "alertCooldownMinutes": 30
  }
}
```
