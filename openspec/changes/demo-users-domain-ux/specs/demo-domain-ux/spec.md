# Spec: Acceso Rápido de Roles, Selector de Ramos y Campos de Cliente Filtrados

## Requirement: Acceso Rápido en 1-Clic a Cuentas de Prueba por Rol
The Login screen MUST provide 1-click test buttons for each RBAC role.

### Scenario: Logging in as Super Admin
- **WHEN** the user clicks "Probar Super Admin" on the login screen
- **THEN** the app MUST authenticate as `super_admin` (`superadmin@comparadorcsa.com`)
- **AND** navigate directly to the Executive Dashboard with global multi-ally permissions.

## Requirement: Rediseño Visual de Ramos en Nueva Comparación
The New Comparison view MUST prominently display all 8 insurance domains organized by category.

### Scenario: Selecting an Insurance Domain
- **WHEN** navigating to "Nueva Comparación"
- **THEN** all 8 insurance domains MUST be visible on the main page grid with clear icons and categories
- **AND** clicking a domain card MUST activate it instantly.

## Requirement: Campos de Cliente Condicionales por Ramo
Client registration fields MUST be strictly scoped to the active insurance domain.

### Scenario: Registering client for Transportes domain
- **GIVEN** the active domain is `transporte`
- **WHEN** opening the new client modal
- **THEN** it MUST display cargo & transit fields
- **AND** it MUST NOT render copropiedad fields like elevators, towers, or seismic zones.
