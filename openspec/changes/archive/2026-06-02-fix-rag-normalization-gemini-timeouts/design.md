## Context

El sistema de comparación de cotizaciones valida y enriquece la información contrastando las coberturas ofrecidas frente a la base de datos de clausulados indexados de las aseguradoras mediante búsquedas semánticas y directas (RAG).

Actualmente, existen dos cuellos de botella que rompen este flujo en producción:
1. **Timeouts en el Motor Unificado (45s)**: Las llamadas al modelo de razonamiento `gemini-3.5-flash` (con `thinkingLevel: MEDIUM`) destinadas a generar la matriz comparativa en formato JSON estructurado exceden con frecuencia el límite de 45 segundos debido a la complejidad de las cotizaciones. Adicionalmente, el controlador `analysisController` aplica un timeout de solo 5 segundos a los pipelines complementarios (RAG, coberturas obligatorias), provocando que se cancelen prematuramente.
2. **Inconsistencia de Nombres de Aseguradoras**: Las cotizaciones son cargadas con nombres comerciales o de razón social largos (ej. "SBS SEGUROS COLOMBIA S.A.", "HDI SEGUROS S.A."), mientras que en el catálogo y base de datos (tablas `documents`, `clause_coverages`) se almacenan bajo nombres normalizados (ej. "SBS", "HDI"). Al consultar con el nombre crudo de la cotización, las consultas no retornan datos, lo que inhabilita por completo la Auditoría de Riesgos RAG.

## Goals / Non-Goals

**Goals:**
* Incrementar la estabilidad del backend evitando la cancelación prematura de comparaciones complejas y análisis RAG mediante la extensión estratégica de timeouts a límites razonables (90s para Gemini, 15s para RAG).
* Asegurar que las consultas de clausulados e historial de versiones en Supabase/Postgres utilicen el nombre de aseguradora normalizado/canónico, garantizando que RAG retorne datos correctos para aseguradoras como SBS e HDI.
* Resolver la auditoría de riesgos para que muestre de forma consistente: "Análisis enriquecido con clausulados" en vez de la advertencia falsa "No hay clausulados indexados disponibles".

**Non-Goals:**
* No se modificará el comportamiento ni la lógica del formateador de moneda COP (Punto 3 del requerimiento original de usuario), ya que se resolverá por separado.
* No se alterará la estructura de los prompts ni los parámetros del modelo Gemini más allá de la tolerancia temporal.

## Decisions

### Decisión 1: Extensión de los límites de timeout
* **Alternativa A**: Mantener los timeouts de 45 segundos para Gemini y 5 segundos para el controlador de análisis, optimizando las peticiones.
* **Alternativa B (Recomendada)**: Incrementar el timeout de Gemini en el motor unificado a **90 segundos** (`TIMEOUT_MS = 90000`) y el del pipeline de análisis complementario a **15 segundos** (`15000ms`).
* **Razón**: Los modelos de razonamiento (thinking models) como Gemini 3.5 requieren tiempo adicional para computar "pensamientos internos" antes de emitir la respuesta en JSON. Un timeout de 90 segundos es tolerado perfectamente por el gateway del servidor (Railway permite hasta 120s) y evita caídas recurrentes. Extender a 15 segundos los submódulos RAG asegura que las búsquedas vectoriales complejas no se interrumpan bajo cargas de red concurrentes.

### Decisión 2: Adopción del Servicio Centralizado de Normalización
* **Alternativa A**: Aplicar sustituciones manuales por expresiones regulares dentro de cada archivo de servicio.
* **Alternativa B (Recomendada)**: Importar e integrar de manera consistente la clase/objeto `insurerNameNormalizer` (desde `insurerNameNormalizer.ts`) en todos los puntos de consulta a base de datos del backend.
* **Razón**: Mantener las reglas de mapeo en un solo lugar (`insurerNameNormalizer`) previene la fragmentación y asegura que la lógica de normalización sea idéntica en la extracción, indexación y validación.

## Risks / Trade-offs

* **[Riesgo] Mayor latencia percibida en fallos reales** ➔ Al extender el timeout a 90s, si Gemini o Supabase realmente están inactivos, el usuario esperará más tiempo antes de recibir el error.
  * *Mitigación*: Se mostrará un estado de progreso progresivo en el frontend para mantener al usuario informado, y el motor unificado tiene mecanismos para reintentar o degradar el servicio si el fallo persiste.
* **[Riesgo] Normalización colisionante** ➔ Aseguradoras con nombres similares podrían normalizarse al mismo identificador.
  * *Mitigación*: La tabla de mapeo de `insurerNameNormalizer` está explícitamente diseñada con patrones deterministas para el mercado de seguros de Colombia (SBS, HDI, Allianz, etc.) mitigando cualquier colisión.
