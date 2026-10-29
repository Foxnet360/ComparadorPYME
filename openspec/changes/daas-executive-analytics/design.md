# Design: Módulo de Analítica Ejecutiva y Plataforma DaaS

## 1. Visión Arquitectónica y Flujo de Datos DaaS

El Comparador CSA pasa de ser una herramienta aislada de cotización a un **Generador de Inteligencia de Mercado Asegurador**.

```
[ FRONT-LINE / CORREDURÍAS ]
   │
   ├─► Cotizaciones cargadas (PDFs / Clausulados)
   │     │
   │     ▼
   │  [ Pipeline Multimodal IA (Gemini + RAG Ontológico) ]
   │     │
   │     ▼
[ CAPA TRANSACCIONAL (OLTP) ]
   │  • public.analysis_history (con PII y RLS por tenant)
   │  • public.policies / public.renewals
   │
   ├──► [ Event Trigger / Worker de Anonimización ]
   │     - Remueve: Nombres de asegurados, NITs, placas, direcciones.
   │     - Preserva: Ramo, Suma asegurada, Prima neta, Deducibles,
   │                 Aseguradora, Coberturas, Decisión (Ganada/Perdida).
   │     │
   │     ▼
[ CAPA ANALÍTICA & DAAS (OLAP / Data Mart) ]
   │  • public.daas_market_snapshots
   │  • public.daas_price_benchmarks (Vistas agregadas)
   │
   ├──────────────────────────────┬──────────────────────────────┐
   │                              │                              │
   ▼                              ▼                              ▼
[ VISTA SUPER ADMIN / CEO ]   [ VISTA ADMIN ALIADO ]   [ API B2B DAAS EXT ]
• Pipeline & Token Health     • Producción de Agencia  • Consumo Aseguradoras
• Cobertura de Datos DaaS     • Ranking de Técnicos    • Benchmarks Actuariales
• Monetización y Consultas    • Benchmark vs Mercado   • Rate Limiting / Quotas
```

## 2. Definición de Pertinencia por Nivel Jerárquico (RBAC)

### Nivel 1: `ally_technical` (Técnico Analista)
- **Propósito:** Optimizar el flujo de trabajo diario y tasa de éxito comercial.
- **Métricas:**
  1. *Estudios en Vuelo vs Cerrados:* Cuántas cotizaciones tiene pendientes de entrega al cliente.
  2. *Tiempo Medio de Respuesta:* De carga de cotización a entrega de comparativo (meta: < 15 min).
  3. *Tasa de Éxito por Ramo:* En qué ramos tiene mayor efectividad de cierre.
  4. *Alertas de Renovación:* Pólizas asignadas próximas a vencer (60/30/15 días).

### Nivel 2: `ally_admin` (Director de Correduría / Agencia)
- **Propósito:** Gestión operativa de equipo, optimización de márgenes y apalancamiento comercial.
- **Métricas:**
  1. *Rendimiento y Carga de Técnicos:* Productividad, volumen de primas y tiempos de respuesta por analista.
  2. *Concentración de Aseguradoras:* Matriz de colocación de primas por compañía (SURA, AXA, CHUBB, etc.) para negociar escalas de comisiones.
  3. *Benchmark de Mercado Anonimizado (Valor DaaS interno):* "¿Cómo cotiza mi agencia frente a la media de la industria?" (ej. prima media en PYME de mi agencia vs promedio del mercado).
  4. *Tasa de Conversión Global de la Agencia.*

### Nivel 3: `super_admin` / CEO (Estrategia Corporativa & DaaS)
- **Propósito:** Salud del ecosistema, rentabilidad operativa y gobierno del modelo DaaS.
- **Métricas:**
  1. *Gobernanza de Activos DaaS:* Volumen de cotizaciones normalizadas, densidad de datos por ramo y salud de anonimización.
  2. *Telemetría de Costos IA vs Utilidad:* Costo de tokens Gemini por estudio vs tarifa cobrada / margen de plataforma.
  3. *Consumo y Monetización de API DaaS:* Número de consultas a endpoints de datos de mercado, aseguradoras conectadas y SLA de API.
  4. *Penetración Multirramo Nacional:* Mapa de calor de volumen asegurado en Colombia.

### Nivel 4: `daas_subscriber` (Consumidores B2B Externos)
- **Propósito:** Suscripción y tarificación actuarial basada en evidencia empírica de mercado.
- **Endpoints & Vistas:**
  - `GET /api/v1/daas/benchmarks/pricing` (Filtros: ramo, rango de suma asegurada, vigencia).
  - `GET /api/v1/daas/benchmarks/coverage-demand` (Amparos más solicitados y tasas de rechazo).

## 3. Modelo de Datos para Soporte DaaS

```sql
-- Repositorio analítico anonimizado para DaaS
CREATE TABLE public.daas_market_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    domain VARCHAR(50) NOT NULL, -- 'pyme', 'autos', 'copropiedades', etc.
    insurer_name VARCHAR(100) NOT NULL,
    insured_value NUMERIC(15, 2) NOT NULL,
    net_premium NUMERIC(15, 2) NOT NULL,
    rate_percentage NUMERIC(6, 4), -- (net_premium / insured_value) * 100
    deductibles_summary JSONB, -- Formato estructurado de deducibles
    status VARCHAR(20) NOT NULL, -- 'WON', 'LOST', 'QUOTED'
    city VARCHAR(100),
    department VARCHAR(100),
    anonymized_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_daas_snapshots_domain ON public.daas_market_snapshots(domain);
CREATE INDEX idx_daas_snapshots_insurer ON public.daas_market_snapshots(insurer_name);
CREATE INDEX idx_daas_snapshots_created ON public.daas_market_snapshots(created_at);

-- Telemetría de consumo DaaS B2B
CREATE TABLE public.daas_api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id UUID NOT NULL,
    endpoint VARCHAR(100) NOT NULL,
    query_params JSONB,
    response_time_ms INTEGER,
    status_code INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 4. Refactorización de Componentes y Servicios

1. **`server/src/routes/analyticsRoutes.ts` y `server/src/controllers/analyticsController.ts`:**
   - Creación de rutas dedicadas en backend:
     - `GET /api/analytics/executive`: Resuelve rol y tenant desde `req.user` y devuelve agregaciones directas de Postgres.
     - `GET /api/analytics/daas/market-index`: Endpoint de benchmarking de mercado.
2. **`services/analyticsService.ts`:**
   - Desacoplar la lógica de filtrado en memoria.
   - Consumir el nuevo endpoint `/api/analytics/executive` pasando los parámetros contextuales sin permitir alteración de rol arbitraria en cliente.
3. **`components/ExecutiveAnalytics.tsx`:**
   - El selector de rol queda restringido:
     - En producción, el rol es fijado por el usuario autenticado (`authService.getCurrentUser()`).
     - Solo los usuarios con rol `super_admin` pueden simular o cambiar vistas para auditar las experiencias de los aliados.
   - Adición de la pestaña/sección de "Visión DaaS & Inteligencia de Mercado".
