# Tasks: Plan de Implementación de Analítica Ejecutiva y Modelo DaaS

## Fase 1: Análisis y Definición del Modelo de Datos Analítico (DaaS Core)
- [x] 1.1 Diseñar migración en Supabase Postgres para la tabla `public.daas_market_snapshots` y triggers de anonimización continua.
- [x] 1.2 Establecer la política de anonimización estricta (limpieza de PII: nombres, documentos de identidad, placas y direcciones bajo Ley 1581).
- [x] 1.3 Diseñar vistas materializadas o funciones RPC para cálculo de agregaciones por rol sin filtrado en cliente.
- [x] 1.4 Definir especificación OpenAPI para los endpoints de benchmarking de mercado DaaS.

## Fase 2: Backend y Seguridad de Acceso Analítico
- [x] 2.1 Implementar `server/src/routes/analyticsRoutes.ts` con protección de autenticación JWT y `requireRole`.
- [x] 2.2 Crear `server/src/services/analyticsAggregationService.ts` para ejecutar queries SQL agrupadas por `org_id` y `user_id`.
- [x] 2.3 Implementar endpoint `GET /api/analytics/executive` con payloads estrictamente ajustados al rol solicitante:
  - Payload para `ally_technical` (Métricas de efectividad personal).
  - Payload para `ally_admin` (Producción de correduría, ranking de equipo y benchmark de mercado).
  - Payload para `super_admin` (Salud del ecosistema, rendimiento LLM y telemetría de datos DaaS).
- [x] 2.4 Implementar worker asíncrono o función de ingesta que pueble `daas_market_snapshots` cada vez que se guarde un análisis en `analysis_history`.
- [x] 2.5 Crear suite de pruebas de aislamiento en `tests/server/analyticsRbac.test.ts`.

## Fase 3: Refactorización del Frontend y UX por Rol
- [x] 3.1 Actualizar `services/analyticsService.ts` para consumir `/api/analytics/executive` en lugar de traer todo el historial a memoria.
- [x] 3.2 Asegurar `components/ExecutiveAnalytics.tsx` para que el usuario no pueda elevar su rol libremente en interfaz; restringir el selector de rol exclusivamente al `super_admin` con fines de auditoría.
- [x] 3.3 Diseñar el panel de "Benchmark de Mercado DaaS" visible para `ally_admin` y `super_admin`.
- [x] 3.4 Agregar métricas de inventario de datos y telemetría de activos DaaS en la vista de `super_admin`.
- [x] 3.5 Verificar compatibilidad y tests unitarios en `src/components/__tests__/ExecutiveAnalytics.test.tsx`.

## Fase 4: Monetización DaaS y Consumo B2B (Fase Estratégica)
- [x] 4.1 Crear sistema de API Keys para suscriptores externos (`daas_subscribers`).
- [x] 4.2 Configurar middleware de rate limiting y registro de telemetría de consumo en `daas_api_usage`.
- [x] 4.3 Generar portal de documentación técnica de la API DaaS para aseguradoras y aliados corporativos.
