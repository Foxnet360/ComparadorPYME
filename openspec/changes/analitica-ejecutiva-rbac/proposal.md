# Proposal: Módulo de Analítica Ejecutiva y Jerarquía de Roles RBAC Multi-Tenant

## Intent
Implementar un sistema de Control de Acceso Basado en Roles (RBAC) jerárquico Multi-Tenant (`super_admin` -> `ally_admin` -> `ally_technical`) e integrar un módulo de **Analítica Ejecutiva** con dashboards de KPIs personalizados por rol para medir la eficiencia técnica, conversión de ventas y salud de la plataforma.

## Scope

### 1. Jerarquía de Roles Multi-Tenant (RBAC)
- **`super_admin` (Administrador General):** Visión global multi-aliado, métricas de red, precisión ontológica global de IA y rendimiento del pipeline.
- **`ally_admin` (Director / Admin de Aliado):** Visión aislada de su correduría (`ally_id`), gestión y productividad de sus técnicos dependientes, conversión de agencia y ranking de aseguradoras.
- **`ally_technical` (Analista Técnico):** Autogestión individual, métricas personales de tiempo de proceso, prima cotizada, tasa de cierre y volumen por ramo.

### 2. Módulo de Analítica Ejecutiva (`ExecutiveAnalytics.tsx`)
- Selector de rango de fechas y filtros dinámicos por aliado/técnico según los permisos del rol.
- Tarjetas de KPIs estratégicos con tendencias.
- Gráficos de conversión, distribución de prima por ramo y tiempos de respuesta.
- Tabla de rendimiento de analistas dependientes (para `ally_admin` y `super_admin`).

### 3. Modelo de Datos y Seguridad RLS
- Tablas `allies` (corredurías) y extensión de `client_profiles` con `ally_id` y `role`.
- Políticas de Row Level Security (RLS) en Supabase Postgres 17 para filtrado estricto por `ally_id` y `user_id`.

## Success Criteria
- Acceso restringido y filtrado por RLS según el rol del usuario autenticado.
- Dashboard de Analítica Ejecutiva interactivo con métricas pertinentes por nivel jerárquico.
- Gestión de equipo funcional para administradores de aliado.
- Compatibilidad completa con la suite de pruebas Vitest.
