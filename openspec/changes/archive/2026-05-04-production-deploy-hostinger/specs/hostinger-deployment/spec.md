# Spec: Hostinger Deployment

## Capability
Configuración y despliegue del comparador de seguros PYME en Hostinger Node.js con dominio personalizado, build automático desde GitHub, y variables de entorno seguras.

## ADDED Requirements

### Requirement: Aplicación Node.js unificada en Hostinger
El sistema DEBE ejecutarse como una sola aplicación Node.js en Hostinger, sirviendo tanto el API backend como los archivos estáticos del frontend desde el mismo proceso.

#### Scenario: Build y deploy automático desde GitHub
- **WHEN** se realiza push a la rama main del repositorio ComparadorPYME en GitHub
- **THEN** Hostinger detecta el cambio automáticamente
- **AND** ejecuta npm install && npm run build
- **AND** inicia la aplicación con npm start
- **AND** la aplicación queda disponible en comparadorpyme.baconhacks.com

#### Scenario: Dominio personalizado con SSL
- **WHEN** un usuario accede a https://comparadorpyme.baconhacks.com
- **THEN** el navegador muestra el sitio sin advertencias de seguridad
- **AND** la conexión utiliza HTTPS con certificado SSL válido

### Requirement: Variables de entorno seguras
El sistema DEBE utilizar variables de entorno configuradas en el panel de Hostinger, nunca en archivos del repositorio.

#### Scenario: Configuración de variables en Hostinger
- **WHEN** un administrador configura GEMINI_API_KEY, SUPABASE_URL, y otras variables en el panel de Hostinger
- **THEN** la aplicación lee estas variables en tiempo de ejecución
- **AND** el repositorio .env.example contiene solo templates sin valores reales

#### Scenario: Fallback de puerto
- **WHEN** Hostinger asigna un puerto dinámico via process.env.PORT
- **THEN** la aplicación utiliza ese puerto
- **AND** si no está definido, utiliza el puerto 8080 como fallback

### Requirement: Frontend servido como SPA estática
El sistema DEBE servir el frontend React como Single Page Application desde Express.

#### Scenario: Rutas del frontend
- **WHEN** un usuario accede a la raíz / o cualquier ruta que no sea /api
- **THEN** Express sirve el archivo index.html del build de React
- **AND** el routing del lado del cliente maneja la navegación

#### Scenario: Assets estáticos
- **WHEN** el navegador solicita archivos JS, CSS, o imágenes
- **THEN** Express sirve estos archivos desde el directorio dist con cache apropiado

## MODIFIED Requirements

## REMOVED Requirements

### Requirement: CORS para desarrollo local
**Reason**: En producción frontend y backend comparten el mismo dominio, eliminando la necesidad de CORS.
**Migration**: CORS se mantiene solo para desarrollo local via configuración condicional.
