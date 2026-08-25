# Design: Módulo de Analítica Ejecutiva y Jerarquía de Roles RBAC Multi-Tenant

## Architectural Overview

```
                      ┌────────────────────────────────────────┐
                      │    SUPER ADMIN (Global Platform)       │
                      │  • Visión global multi-aliado          │
                      │  • Precisión de IA y salud de pipeline │
                      └───────────────────┬────────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  │                                               │
   ┌──────────────▼───────────────┐               ┌───────────────▼──────────────┐
   │   ADMIN ALIADO (Agencia A)   │               │   ADMIN ALIADO (Agencia B)   │
   │  • Visión de su correduría   │               │  • Visión de su correduría   │
   │  • Métricas de sus técnicos  │               │  • Métricas de sus técnicos  │
   └──────────────┬───────────────┘               └──────────────┬───────────────┘
                  │                                              │
      ┌───────────┴───────────┐                      ┌───────────┴───────────┐
      │                       │                      │                       │
 ┌────▼────┐             ┌────▼────┐            ┌────▼────┐             ┌────▼────┐
 │ TÉCNICO │             │ TÉCNICO │            │ TÉCNICO │             │ TÉCNICO │
 │(Analista)             │(Analista)            │(Analista)             │(Analista)
 └─────────┘             └─────────┘            └─────────┘             └─────────┘
```

## Database Schema Extensions

### `public.allies`
- `id` (UUID, PK)
- `name` (TEXT, NOT NULL)
- `nit` (TEXT)
- `created_at` (TIMESTAMPTZ)

### `public.client_profiles` (Extensión)
- `role` (TEXT, CHECK: 'super_admin', 'ally_admin', 'ally_technical')
- `ally_id` (UUID, FK -> `public.allies(id)`)

## Component Architecture

### 1. `components/ExecutiveAnalytics.tsx`
- Componente principal de analítica ejecutiva con pestañas de vistas según rol:
  - **Vista Analista:** Mis Métricas, Mi Conversión, Distribución por Ramo.
  - **Vista Admin Aliado:** Producción del Equipo, Ranking de Analistas, Desempeño por Aseguradora.
  - **Vista Super Admin:** Salud Global Multi-Aliado, IA Benchmark, Tiempos de Respuesta de API.

### 2. `services/analyticsService.ts`
- Servicio cliente/servidor para agregar métricas de producción y calcular KPIs:
  - `getPersonalKPIs(userId)`
  - `getAllyKPIs(allyId)`
  - `getGlobalKPIs()`

### 3. Navigation & Views (`App.tsx`)
- Incorporar opción de menú "Analítica Ejecutiva" visible según permisos de rol.
- Pasar el contexto de usuario activo con `role` y `ally_id` a la navegación.
