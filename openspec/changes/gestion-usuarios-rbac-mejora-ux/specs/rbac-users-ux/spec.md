# Spec: CRUD RBAC, Monitor de Tokens IA y UX de Clientes/Clausulados

## Requirement: CRUD de Usuarios y Aliados Jerárquico
The application MUST provide role-scoped user management.

### Scenario: Ally Admin managing technical team
- **GIVEN** an `ally_admin` user
- **WHEN** accessing the user management panel
- **THEN** they MUST see only analysts belonging to their `ally_id`
- **AND** they MUST be able to create, edit, and deactivate `ally_technical` accounts for their organization.

### Scenario: Super Admin managing allies and global users
- **GIVEN** a `super_admin` user
- **WHEN** accessing user management
- **THEN** they MUST be able to create and manage Ally Organizations
- **AND** they MUST be able to view, assign, and modify roles for any user globally.

## Requirement: Monitor de Consumo y Costos de IA para Super Admin
The Executive Analytics dashboard MUST include a Token & Cost Monitor for `super_admin`.

### Scenario: Viewing Token Metrics
- **GIVEN** a `super_admin` on Executive Analytics
- **WHEN** viewing the platform metrics
- **THEN** it MUST display total Input/Output tokens used, average cost per comparison (USD/COP), and token breakdown by Ally.

## Requirement: Formulario Dinámico de Cliente por Ramo
Client creation/editing MUST dynamically render specific fields based on the selected insurance domain.

### Scenario: Selecting Transportes domain for client
- **GIVEN** the user selects the "Transporte de Mercancías" domain
- **WHEN** opening the client details form
- **THEN** it MUST display cargo-specific fields (cargo type, max dispatch value, transit routes).

## Requirement: Biblioteca de Clausulados Mejorada
The clause library MUST allow instant search, domain filtering, and text previewing.

### Scenario: Filtering and previewing master clauses
- **GIVEN** the analyst is in the Clause Library (`ClauseAdmin`)
- **WHEN** selecting a domain filter or searching by insurer
- **THEN** the list MUST filter instantly
- **AND** clicking a clause MUST open a full text preview modal with vector indexing status.
