# Tasks: Módulo de Analítica Ejecutiva y Jerarquía de Roles RBAC Multi-Tenant

## Phase 1: Modelo de Datos & Tipos RBAC
- [ ] 1.1 Definir tipos TypeScript para `UserRole` (`super_admin`, `ally_admin`, `ally_technical`), `Ally` y métricas de analítica en `types.ts`.
- [ ] 1.2 Extender el esquema de base de datos con tabla `public.allies` y migración SQL con soporte RLS.

## Phase 2: Servicio de Analítica (`services/analyticsService.ts`)
- [ ] 2.1 Crear `analyticsService.ts` con cálculo de KPIs por nivel jerárquico.
- [ ] 2.2 Implementar agregaciones por analista, por aliado y consolidados globales.

## Phase 3: Módulo de Analítica Ejecutiva (`components/ExecutiveAnalytics.tsx`)
- [ ] 3.1 Construir la interfaz de **Analítica Ejecutiva** adaptativa según el rol del usuario.
- [ ] 3.2 Implementar gráficos/tarjetas de tendencias, conversión y prima comparada.
- [ ] 3.3 Crear tabla de desempeño de analistas para administradores de aliado y super admin.

## Phase 4: Integración en Navegación & Autenticación (`App.tsx` & `Navigation.tsx`)
- [ ] 4.1 Agregar botón de acceso a "Analítica Ejecutiva" en la navegación principal.
- [ ] 4.2 Configurar cuentas/roles de demostración para pruebas rápidas entre roles (`Super Admin`, `Admin Aliado`, `Analista Técnico`).

## Phase 5: Verificación & Pruebas
- [ ] 5.1 Crear pruebas unitarias para `analyticsService.ts` y componentes visuales.
- [ ] 5.2 Validar aislamiento de datos multi-tenant y compilación limpia con `npm test`.
