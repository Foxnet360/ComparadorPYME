# Proposal: Evolución del Módulo de Analítica Ejecutiva hacia un Modelo DaaS (Data as a Service)

## Intent
Transformar el módulo actual de Analítica Ejecutiva de un visualizador operativo estático con datos locales a un **motor analítico de valor estratégico y plataforma DaaS (Data as a Service)**. 

Esta evolución responde a dos imperativos:
1. **Coherencia y pertinencia por rol:** Adaptar los KPIs y la experiencia analítica a las necesidades operativas reales de cada actor (`ally_technical`, `ally_admin`, `super_admin`/CEO, y el futuro rol consumidor `data_subscriber`).
2. **Transformación Digital y Visión DaaS:** Capitalizar el activo de información más valioso de Comparador CSA (tarifas de mercado en tiempo real, dispersión de deducibles, apetito de suscripción y patrones de conversión por ramo) para habilitar productos de datos B2B monetizables dirigidos a aseguradoras, reaseguradoras y directivos, cumpliendo con anonimización y gobernanza de datos (Habeas Data Ley 1581 / Superfinanciera).

## Scope

### 1. Pertinencia de Negocio por Rol (Business Logic Alignment)
- **`ally_technical` (Analista Técnico / Comercial):**
  - **Foco:** Eficiencia operativa, efectividad de cierre y gestión de cartera diaria.
  - **KPIs clave:** Win-rate personal por ramo, tiempo medio de entrega de estudio vs benchmark de correduría, embudo de renovaciones en riesgo de fuga, primas cerradas vs cotizadas.
- **`ally_admin` (Director de Correduría / Agencia Aliada):**
  - **Foco:** Rendimiento de equipo, rentabilidad de cartera y posición competitiva.
  - **KPIs clave:** Producción agregada de la agencia, ranking de productividad de técnicos, concentración y distribución de cartera por aseguradora (para negociación de acuerdos/slips), y benchmarking de primas promedio de su agencia frente al percentil del mercado (anonimizado).
- **`super_admin` / CEO (Gobierno de Plataforma y Visión Estratégica):**
  - **Foco:** Crecimiento del ecosistema, salud del pipeline de extracción IA y telemetría de activos de datos.
  - **KPIs clave:** Volumen total transaccionado, penetración multirramo, costos de inferencia LLM vs ingreso por estudio, y métricas del Data Lake (volumen de pólizas normalizadas listas para DaaS).
- **`data_subscriber` (Nuevo Rol B2B - Aseguradoras / Actuarios):**
  - **Foco:** Inteligencia de mercado, pricing dinámico y apetito de suscripción.
  - **KPIs clave:** CSA Market Price Index por ramo/ciudad, análisis de dispersión de deducibles ofrecidos por competidores, amparos más demandados vs excluidos.

### 2. Arquitectura de Datos para DaaS (Data as a Service)
- **Pipeline de Anonimización y Limpieza de PII:** Separación estricta entre datos transaccionales con PII (nombres, NITs, placas, direcciones) y el repositorio analítico anonimizado (`daas_market_snapshots`).
- **Data Products Iniciales:**
  - *Índice de Precios CSA:* Benchmark de prima promedio por tipo de riesgo y suma asegurada.
  - *Radar de Apetito Asegurador:* Frecuencia de rechazo/oferta de coberturas por compañía.
  - *Matriz de Elasticidad de Renovación:* Factores determinantes en retención vs migración de pólizas.
- **Capa de Servicio API DaaS:** Endpoints asegurados con API Keys, cuotas de consulta y registro de auditoría para consumo externo B2B.

### 3. Backend & Seguridad RLS
- Eliminación del filtrado en memoria en el cliente (`analyticsService.ts`).
- Creación de vistas analíticas / RPC en Supabase Postgres con agregaciones server-side seguras bajo RLS.
- Enforzamiento estricto de roles desde el token JWT; el usuario solo recibe el payload de su tenant y nivel jerárquico.

## Success Criteria
- [ ] Seguridad: Eliminación de selectores de rol manipulables en frontend; aislamiento RLS garantizado.
- [ ] Performance: Carga de métricas ejecutivas < 300ms mediante agregaciones precalculadas / vistas en base de datos.
- [ ] Coherencia de Negocio: Vistas diferenciadas y pertinentes para cada rol sin sobrecarga cognitiva.
- [ ] Fundamentos DaaS: Modelo de datos analítico anonimizado y primer endpoint funcional de benchmark de mercado.
- [ ] Cumplimiento Regulatorio: Garantía de no exposición de PII ni datos sensibles de corredurías competidoras.

## Rollback Plan
- Las tablas analíticas y vistas de datos se implementan sin alterar las tablas transaccionales existentes (`analysis_history`, `policies`, `renewals`).
- El servicio frontend mantendrá compatibilidad con la vista actual mediante feature flag `ENABLE_DAAS_ANALYTICS`.
