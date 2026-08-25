# Tasks: CRUD RBAC, Monitor de Tokens IA y UX Dinámica de Clientes y Clausulados

## Phase 1: Perfil de Usuario & Gestión CRUD RBAC
- [ ] 1.1 Actualizar `ProfileScreen.tsx` para mostrar badge visual de Rol (`Super Admin`, `Admin Aliado`, `Analista Técnico`) y nombre de Aliado.
- [ ] 1.2 Crear servicio `services/userService.ts` para operaciones CRUD de usuarios y aliados.
- [ ] 1.3 Crear componente `components/UserManagement.tsx` con soporte para `ally_admin` (gestión de su equipo) y `super_admin` (gestión de todos los aliados y usuarios).

## Phase 2: Monitor de Consumo de Tokens & Costos IA (Super Admin)
- [ ] 2.1 Ampliar `analyticsService.ts` con métricas de consumo de tokens (Input/Output), costo estimado USD/COP y consumo por Aliado.
- [ ] 2.2 Integrar la sección "Monitor de Consumo & Costos de IA" en `ExecutiveAnalytics.tsx` visible para `super_admin`.

## Phase 3: Perfil Dinámico de Cliente por Ramo
- [ ] 3.1 Actualizar el tipo `Client` en `types.ts` con campos dinámicos específicos por ramo (*PYME, Daños, Transportes, Equipo Electrónico*).
- [ ] 3.2 Actualizar `ClientSelector.tsx` y `ClientManager.tsx` para renderizar condicionalmente los campos específicos del ramo activo.

## Phase 4: Optimización de la Biblioteca de Clausulados (`ClauseAdmin.tsx`)
- [ ] 4.1 Rediseñar `ClauseAdmin.tsx` con barra de búsqueda rápida, filtro por los 8 ramos y badge de indexación PGVector 3072d.
- [ ] 4.2 Crear modal de previsualización de texto completo y secciones del clausulado maestro.

## Phase 5: Navegación, Verificación y Pruebas
- [ ] 5.1 Conectar `UserManagement` en la barra de navegación principal para `ally_admin` y `super_admin`.
- [ ] 5.2 Crear pruebas unitarias y verificar compatibilidad completa con `npm test`.
