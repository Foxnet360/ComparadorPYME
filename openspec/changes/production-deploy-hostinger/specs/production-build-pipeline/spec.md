# Spec: Production Build Pipeline

## Capability
Pipeline de build unificado que compila frontend (Vite) y backend (TypeScript) en Hostinger durante el deploy.

## ADDED Requirements

### Requirement: Build unificado de frontend y backend
El sistema DEBE compilar tanto frontend como backend con un solo comando npm run build.

#### Scenario: Build completo en Hostinger
- **WHEN** Hostinger ejecuta npm run build durante el deploy
- **THEN** primero compila el frontend con Vite (npm run build:frontend)
- **AND** luego compila el backend TypeScript (npm run build:backend)
- **AND** copia archivos de datos necesarios (thesaurus.json)
- **AND** genera directorios dist/ para ambos

#### Scenario: Build de frontend
- **WHEN** se ejecuta npm run build:frontend
- **THEN** Vite compila la aplicación React en modo producción
- **AND** genera archivos estáticos optimizados en dist/
- **AND** los archivos JS/CSS están minificados y con hash para cache busting

#### Scenario: Build de backend
- **WHEN** se ejecuta npm run build:backend
- **THEN** TypeScript compila server/src/ a server/dist/
- **AND** copia server/src/data/ a server/dist/data/
- **AND** no incluye archivos de test ni scripts de debug

### Requirement: Start command para producción
El sistema DEBE iniciar con npm start ejecutando únicamente el backend compilado.

#### Scenario: Inicio en producción
- **WHEN** Hostinger ejecuta npm start
- **THEN** inicia node server/dist/index.js
- **AND** Express sirve el frontend estático desde dist/
- **AND** carga variables de entorno desde el sistema (no desde .env files)

### Requirement: Dependencias de producción minimizadas
El sistema DEBE instalar solo dependencias necesarias para producción.

#### Scenario: Instalación en Hostinger
- **WHEN** Hostinger ejecuta npm install
- **THEN** instala solo dependencias listadas en dependencies (no devDependencies)
- **AND** no instala herramientas de desarrollo como nodemon, ts-node, o vitest

## MODIFIED Requirements

## REMOVED Requirements

### Requirement: Desarrollo con dos procesos separados
**Reason**: En producción frontend y backend corren en el mismo proceso Express.
**Migration**: Para desarrollo local se mantiene concurrently en devDependencies.
