# Proposal: Entidad Real de Organizaciones y RLS a Nivel de Equipo (Multi-Tenant Core)

## Intent
Transformar la arquitectura multi-tenant de Comparador CSA desde su estado actual de aislamiento estrictamente monousuario (`user_id = auth.uid()`) hacia una jerarquía real de equipos basada en organizaciones. Esto permitirá que los analistas técnicos (`ally_technical`) y directores de correduría (`ally_admin`) pertenecientes a un mismo aliado colaboren compartiendo clientes, pólizas, cotizaciones y renovaciones bajo políticas RLS seguras en Supabase Postgres, manteniendo el aislamiento estricto entre corredurías distintas.

## Scope
1. **Modelo de Datos en Postgres (`server/supabase/migrations/029_organizations_and_team_rls.sql`):**
   - Crear tablas `organizations` (id, name, nit, status, settings) y `organization_members` (id, org_id, user_id, role).
   - Crear funciones `SECURITY DEFINER` optimizadas (`is_org_member`, `get_current_user_org_ids`) compatibles con el patrón dual de autenticación (`auth.uid()` / `current_setting('app.current_user_id')`).
   - Evolucionar políticas RLS en `clients`, `policies`, `renewals`, `analysis_history` y `campaign_configs` para permitir acceso tanto por propietario directo (`user_id`) como por membresía de equipo (`org_id`).
   - Backfill idempotente: poblar `organizations` y `organization_members` para usuarios existentes y asociar `org_id` en filas huérfanas.
2. **Capa Backend (Express & Repositorios):**
   - Extender `AuthenticatedRequest` en `server/src/middleware/auth.ts` para resolver y portar `orgId` y `role`.
   - Incorporar middleware guard `requireRole(['super_admin', 'ally_admin'])` y validación de tenant.
   - Actualizar repositorios (`clientRepository`, `policyRepository`, `renewalRepository`) para inyectar y consultar por `org_id`.
   - Crear endpoints `/api/organizations` y `/api/organizations/members` para administración de equipos.
3. **Capa Frontend (Sustitución de Mocks):**
   - Reemplazar el estado local en memoria (`DEMO_ALLIES`, `DEMO_ANALYSTS`) en `components/UserManagement.tsx` y `services/analyticsService.ts` por llamadas a la API real.
   - Enlazar el registro de nuevos aliados en `LandingPage.tsx` / `RegisterScreen.tsx` con la persistencia en `organizations` y asignación de rol en `app_metadata`.

## Rollback Plan
- **Migración Reversible:** La migración `029` mantiene compatibilidad hacia atrás mediante `OR user_id = current_user_id`. En caso de rollback, un script de reversión elimina las funciones auxiliares y restablece las políticas monousuario originales de la migración `026`.
- **Datos Seguros:** Las tablas preexistentes no se truncan ni sufren alteración de tipos destructivos; `org_id` ya existía como columna nullable desde la migración `022`.

## Feature Flags
- `ENABLE_TEAM_COLLABORATION_RLS`: Variable de entorno / flag en `server/src/config/featureFlags.ts` (default: `true` en staging/prod tras validación).
