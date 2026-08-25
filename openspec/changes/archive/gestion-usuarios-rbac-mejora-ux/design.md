# Design: CRUD RBAC, Monitor de Tokens IA y UX Dinámica de Clientes y Clausulados

## Architecture & Component Map

### 1. `components/UserManagement.tsx`
- Componente de gestión de usuarios adaptativo por rol:
  - Para `ally_admin`: Gestión exclusiva de técnicos (`ally_technical`) pertenecientes a su `ally_id`.
  - Para `super_admin`: Gestión de Aliados/Corredurías (`allies`) + Gestión Global de Usuarios (cambio de rol, reasignación de aliado, alta/baja).

### 2. `components/ProfileScreen.tsx`
- Insignia destacada en el encabezado con el rol del usuario (`SUPER ADMINISTRADOR`, `ADMINISTRADOR DE ALIADO`, `TÉCNICO ANALISTA`) y datos del Aliado.

### 3. `components/ExecutiveAnalytics.tsx` (Sección Tokens IA)
- Inclusión del bloque "Monitor de Consumo & Costos de IA" visible para `super_admin`:
  - Consumo total de tokens (Input + Output).
  - Costo medio por estudio ($ USD y $ COP).
  - Tabla de consumo por Aliado.

### 4. `components/ClientSelector.tsx` & `components/ClientManager.tsx`
- Extensión del modelo de cliente con campos condicionales por `domain`:
  - `commercialAssets`, `employeeCount` (PYME)
  - `fireProtectionSystem`, `constructionType` (Daños Materiales)
  - `transitCargoType`, `maxDispatchValue` (Transportes)
  - `equipmentAge`, `maintenanceProgram` (Equipo Electrónico & Maquinaria)
- Integración en la generación de informes técnicos.

### 5. `components/ClauseAdmin.tsx`
- Rediseño de la interfaz de la biblioteca de clausulados:
  - Barra de búsqueda rápida con debounce.
  - Filtro por Ramo (8 ramos).
  - Modal de previsualización de texto completo y secciones.
  - Estado de indexación PGVector 3072d.
