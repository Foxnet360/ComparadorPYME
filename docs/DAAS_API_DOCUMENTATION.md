# Portal de Documentación Técnica: API B2B de Inteligencia de Mercado DaaS (Data as a Service)

## 1. Visión General

La **API DaaS de Comparador CSA** proporciona acceso programático a inteligencia actuarial y benchmarking de mercado en tiempo real sobre el sector asegurador colombiano.

A través de esta interfaz, compañías aseguradoras, reaseguradoras, corredurías mayoristas y firmas de analítica actuarial pueden consultar datos agregados y normalizados derivados de miles de cotizaciones procesadas en la plataforma, con estricto cumplimiento del régimen de **Habeas Data (Ley 1581 de 2012)** y salvaguardas de **k-anonimato ($k \ge 5$)**.

---

## 2. Autenticación y Esquema de Llaves

Las peticiones a la API DaaS requieren una **API Key institucional**.

La clave puede enviarse en cualquiera de los siguientes encabezados HTTP:
* **Header `X-API-Key`:**
  ```http
  X-API-Key: csa_live_a1b2c3d4e5f6...
  ```
* **Header `Authorization` (Bearer token):**
  ```http
  Authorization: Bearer csa_live_a1b2c3d4e5f6...
  ```

> [!IMPORTANT]
> Las API Keys se almacenan en la base de datos de CSA mediante hashing criptográfico **SHA-256**. CSA nunca almacena ni expone tu llave en texto plano. En caso de pérdida, debe solicitarse la revocación y reexpedición.

---

## 3. Planes, Niveles de Servicio y Cuotas

| Nivel (Tier) | Cuota Mensual | Límite por Minuto | Cobertura de Ramos | SLA de Disponibilidad |
| :--- | :--- | :--- | :--- | :--- |
| **TIER_1 (Básico)** | 2,000 consultas | 60 req/min | 2 Ramos a elección | 99.5% |
| **TIER_2 (Profesional)** | 10,000 consultas | 180 req/min | Todos los ramos estándar | 99.8% |
| **ENTERPRISE (Sindicado)**| 50,000+ consultas | 600 req/min | Acceso total multirramo + webhooks | 99.9% |

### Encabezados de Telemetría en Cada Respuesta:
* `X-RateLimit-Limit`: Límite de ráfaga por minuto.
* `X-Quota-Monthly`: Cuota mensual total contratada.
* `X-Quota-Remaining`: Consultas restantes en el ciclo de facturación activo.

---

## 4. Catálogo de Endpoints

### 4.1 Índice de Tarifas y Percentiles Actuariales
`GET /api/v1/daas/benchmarks/pricing`

Calcula la dispersión actuarial de primas anuales por ramo para una ventana de tiempo determinada.

#### Parámetros Query:
* `domain` *(string, obligatorio)*: Ramo a consultar (`pyme`, `autos`, `hogar`, `copropiedades`, `salud`, `vida_grupo`, `transporte`, `cumplimiento`).
* `periodMonths` *(integer, opcional, default: 6)*: Ventana temporal en meses hacia atrás (1 - 24).

#### Ejemplo de Petición (cURL):
```bash
curl -X GET "https://api.comparadorcsa.com/api/v1/daas/benchmarks/pricing?domain=pyme&periodMonths=6" \
  -H "X-API-Key: csa_live_sura_test_key_123456789"
```

#### Ejemplo de Respuesta (`200 OK`):
```json
{
  "success": true,
  "data": {
    "domain": "pyme",
    "sampleSize": 142,
    "avgPremiumAnnual": 4850000,
    "medianPremiumAnnual": 4500000,
    "percentile25": 3800000,
    "percentile75": 5600000,
    "topInsurers": [
      { "insurerName": "SURA", "quoteCount": 45, "avgPrice": 4600000 },
      { "insurerName": "AXA Colpatria", "quoteCount": 38, "avgPrice": 4950000 },
      { "insurerName": "CHUBB", "quoteCount": 29, "avgPrice": 5100000 }
    ],
    "calculatedAt": "2026-10-29T18:05:00.000Z"
  }
}
```

---

### 4.2 Participación de Mercado por Aseguradora
`GET /api/v1/daas/benchmarks/market-share`

Distribución porcentual de cotizaciones por compañía aseguradora.

#### Parámetros Query:
* `domain` *(string, opcional)*: Filtrar por ramo específico. Si se omite, calcula la participación cross-ramo.

#### Ejemplo de Respuesta (`200 OK`):
```json
{
  "success": true,
  "data": {
    "totalAnalyzedQuotes": 520,
    "insurers": [
      { "insurerName": "SURA", "quoteCount": 182, "sharePercentage": 35.0 },
      { "insurerName": "AXA Colpatria", "quoteCount": 130, "sharePercentage": 25.0 },
      { "insurerName": "CHUBB", "quoteCount": 83, "sharePercentage": 16.0 },
      { "insurerName": "SBS Seguros", "quoteCount": 65, "sharePercentage": 12.5 }
    ]
  }
}
```

---

### 4.3 Estado de Cuota y Suscripción
`GET /api/v1/daas/subscriber/status`

Permite a los suscriptores verificar programáticamente el consumo de su plan.

#### Ejemplo de Respuesta (`200 OK`):
```json
{
  "success": true,
  "data": {
    "subscriberId": "sub-uuid-1234",
    "name": "Aseguradora SURA - Dirección Actuarial",
    "tier": "ENTERPRISE",
    "monthlyQuota": 50000,
    "currentMonthUsage": 1420,
    "remainingQuota": 48580,
    "rateLimitPerMinute": 600,
    "allowedDomains": ["all"]
  }
}
```

---

## 5. Ejemplos de Implementación

### Python
```python
import requests

API_KEY = "csa_live_sura_test_key_123456789"
BASE_URL = "https://api.comparadorcsa.com/api/v1/daas"

headers = {
    "X-API-Key": API_KEY,
    "Accept": "application/json"
}

response = requests.get(
    f"{BASE_URL}/benchmarks/pricing",
    params={"domain": "pyme", "periodMonths": 3},
    headers=headers
)

if response.status_code == 200:
    data = response.json()["data"]
    print(f"Mediana P50 para PYME: ${data['medianPremiumAnnual']:,.2f} COP")
    print(f"Muestra analizada: {data['sampleSize']} cotizaciones")
else:
    print(f"Error {response.status_code}: {response.text}")
```

### TypeScript / Node.js
```typescript
async function fetchPymeMarketBenchmark(apiKey: string) {
  const url = new URL('https://api.comparadorcsa.com/api/v1/daas/benchmarks/pricing');
  url.searchParams.set('domain', 'pyme');
  url.searchParams.set('periodMonths', '6');

  const res = await fetch(url.toString(), {
    headers: {
      'X-API-Key': apiKey,
    },
  });

  if (!res.ok) {
    throw new Error(`DaaS API Error ${res.status}: ${await res.text()}`);
  }

  const payload = await res.json();
  return payload.data;
}
```

---

## 6. Códigos de Error HTTP

| Código | Mensaje | Causa y Acción |
| :--- | :--- | :--- |
| `401 Unauthorized` | DaaS API Key required | Encabezado `X-API-Key` ausente o no reconocido. |
| `403 Forbidden` | Domain not allowed for subscriber tier | Tu plan no incluye el ramo solicitado. Contactá soporte para ampliar tu suscripción. |
| `429 Too Many Requests` | Monthly DaaS query quota exceeded | Has superado la cuota de consultas contratada para el mes. |
| `500 Internal Error` | Internal server error | Error en la plataforma. Notificá al equipo de ingeniería de CSA. |
