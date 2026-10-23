# Tasks: Implementación de Entidad Real de Organizaciones y RLS Multi-Tenant

## Fase 1: Migración de Base de Datos y Funciones RLS
- [x] 1.1 Crear archivo de migración `server/supabase/migrations/029_organizations_and_team_rls.sql`.
- [x] 1.2 Definir tablas `public.organizations` y `public.organization_members` con índices en `(org_id, user_id)`.
- [x] 1.3 Implementar funciones `SECURITY DEFINER` `public.is_org_member(UUID)` y `public.is_super_admin()`.
- [x] 1.4 Actualizar políticas RLS de `clients`, `policies` y `renewals` para habilitar acceso colaborativo.
- [x] 1.5 Crear script de backfill idempotente para usuarios y carteras existentes sin `org_id`.
- [x] 1.6 Escribir suite de pruebas de migración en `tests/server/migrations/organizationTeamRls.test.ts`.

## Fase 2: Backend Express y Repositorios
- [x] 2.1 Actualizar `server/src/middleware/auth.ts` para extraer `orgId` y `role` de JWT / `app_metadata`.
- [x] 2.2 Crear middleware `requireRole` para protección de rutas exclusivas de administración.
- [x] 2.3 Actualizar `clientRepository`, `policyRepository` y `renewalRepository` para persistir y filtrar con `org_id`.
- [x] 2.4 Implementar rutas REST `/api/organizations` y `/api/organizations/members` para CRUD de equipo.
- [x] 2.5 Escribir tests de integración de aislamiento cross-tenant (Organización A no lee Organización B, Analista 1 y Analista 2 de Organización A comparten registros).

## Fase 3: Frontend y Desconexión de Mocks
- [x] 3.1 Actualizar `services/authService.ts` para reflejar la estructura de organizaciones reales.
- [x] 3.2 Refactorizar `components/UserManagement.tsx` sustituyendo `DEMO_ALLIES` por llamadas a `/api/organizations`.
- [x] 3.3 Conectar `services/analyticsService.ts` a queries de base de datos agrupadas por `org_id`.
- [x] 3.4 Validar flujo integral de registro en `LandingPage.tsx` / `RegisterScreen.tsx`.
