# Spec: Supabase Auth

## Capability
Autenticación de usuarios usando Supabase Auth con email/password, controlando el acceso a la aplicación.

## ADDED Requirements

### Requirement: Autenticación con email y password
El sistema DEBE permitir a los usuarios iniciar sesión con email y password usando Supabase Auth.

#### Scenario: Inicio de sesión exitoso
- **WHEN** un usuario ingresa email y password válidos en el formulario de login
- **THEN** Supabase Auth valida las credenciales
- **AND** el sistema crea una sesión JWT
- **AND** redirige al usuario al dashboard principal

#### Scenario: Credenciales inválidas
- **WHEN** un usuario ingresa email o password incorrectos
- **THEN** el sistema muestra mensaje de error sin revelar cuál campo es incorrecto
- **AND** no crea sesión

### Requirement: Control de acceso para usuarios
El sistema DEBE restringir el registro a usuarios autorizados.

#### Scenario: Registro restringido
- **WHEN** un usuario intenta registrarse con un email no autorizado
- **THEN** el sistema rechaza el registro
- **AND** muestra mensaje indicando que el acceso es por invitación

#### Scenario: Usuario autorizado
- **WHEN** un usuario con email autorizado completa el registro
- **THEN** Supabase Auth crea la cuenta
- **AND** el sistema envía email de confirmación
- **AND** al confirmar, el usuario puede acceder a la aplicación

### Requirement: Gestión de sesión
El sistema DEBE mantener la sesión del usuario de forma segura.

#### Scenario: Sesión persistente
- **WHEN** un usuario cierra y reabre el navegador
- **THEN** la sesión se recupera automáticamente si el token JWT es válido
- **AND** si el token expiró, se redirige al login

#### Scenario: Cierre de sesión
- **WHEN** un usuario hace clic en "Cerrar sesión"
- **THEN** el sistema invalida el token JWT
- **AND** limpia datos de sesión del cliente
- **AND** redirige a la página de login

### Requirement: Perfil de usuario básico
El sistema DEBE permitir a los usuarios ver y editar su perfil básico.

#### Scenario: Ver perfil
- **WHEN** un usuario autenticado accede a su perfil
- **THEN** el sistema muestra email, nombre, y fecha de registro

#### Scenario: Actualizar nombre
- **WHEN** un usuario edita su nombre y guarda
- **THEN** el sistema actualiza el perfil en Supabase
- **AND** muestra confirmación de éxito

## MODIFIED Requirements

## REMOVED Requirements

### Requirement: Autenticación local (sin Supabase)
**Reason**: Se migra a Supabase Auth para centralizar autenticación y aprovechar infraestructura existente.
**Migration**: Usuarios existentes deben re-registrarse via Supabase Auth con sus emails autorizados.
