# Spec: Production Repository Structure

## Capability
Estructura de repositorio limpia y organizada para producción, excluyendo archivos de desarrollo, tests, y documentación interna.

## ADDED Requirements

### Requirement: Repo limpio sin archivos de desarrollo
El repositorio de producción DEBE contener únicamente código fuente, configuración de build, y documentación mínima necesaria para deploy.

#### Scenario: Estructura del repositorio
- **WHEN** se clona el repositorio ComparadorPYME
- **THEN** contiene únicamente archivos necesarios para producción
- **AND** no incluye tests, scripts debug, mocks, ni documentación de desarrollo
- **AND** el tamaño total es menor a 5MB (sin node_modules)

#### Scenario: Archivos excluidos
- **WHEN** un desarrollador revisa el contenido del repo
- **THEN** no encuentra archivos .log, .env con valores reales, ni carpetas __tests__
- **AND** no encuentra scripts de debug ni mocks de prueba

### Requirement: Separación frontend/backend unificada
El repositorio DEBE mantener frontend y backend en directorios separados pero con build unificado.

#### Scenario: Estructura de directorios
- **WHEN** se examina la raíz del repositorio
- **THEN** existen directorios server/ y client/ (o componentes/ services/ en raíz para frontend)
- **AND** un package.json raíz orquesta el build de ambos
- **AND** server/src/ contiene solo código fuente TypeScript (sin tests/)

### Requirement: Documentación mínima para producción
El repositorio DEBE incluir solo documentación esencial para deploy y operación.

#### Scenario: README de producción
- **WHEN** se abre README.md
- **THEN** contiene instrucciones de deploy en Hostinger
- **AND** lista de variables de entorno requeridas
- **AND** pasos para build y start
- **AND** no contiene documentación de diseño ni decisiones de desarrollo

## MODIFIED Requirements

## REMOVED Requirements

### Requirement: Documentación de desarrollo en el repo
**Reason**: Documentación de diseño, tesauros, y decisiones de arquitectura no son necesarias en producción.
**Migration**: Documentación de desarrollo se mantiene en el repositorio original de desarrollo.

### Requirement: Scripts de testing en producción
**Reason**: Tests se ejecutan en desarrollo/CI, no en producción.
**Migration**: Tests permanecen en el repo de desarrollo. No se ejecutan en Hostinger.
