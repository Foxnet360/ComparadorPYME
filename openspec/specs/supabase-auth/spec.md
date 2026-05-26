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

#### Scenario: Registro sin confirmación
- **WHEN** un usuario completa el formulario de registro con email y password válidos
- **THEN** Supabase Auth crea la cuenta inmediatamente
- **AND** el usuario puede iniciar sesión sin esperar confirmación por email

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

### Requirement: Registro inmediato sin verificación
El sistema DEBE permitir el registro de usuarios sin envío de email de confirmación.

#### Scenario: Registro exitoso sin email
- **WHEN** un nuevo usuario ingresa email, password y nombre en el formulario de registro
- **THEN** el sistema crea la cuenta en Supabase Auth sin enviar email de confirmación
- **AND** muestra mensaje de éxito indicando que puede iniciar sesión inmediatamente
- **AND** el usuario puede usar esas credenciales para iniciar sesión sin pasos adicionales

#### Scenario: Inicio de sesión después de registro
- **WHEN** un usuario recién registrado intenta iniciar sesión con sus credenciales
- **THEN** el sistema valida email y password
- **AND** crea una sesión JWT válida
- **AND** redirige al dashboard principal sin requerir confirmación previa

## MODIFIED Requirements

## REMOVED Requirements

### Requirement: Confirmación por email
**Reason**: El plan gratuito de Supabase tiene un límite de ~3 emails por hora, lo que bloquea registros de nuevos usuarios. Se desactiva temporalmente para permitir registro fluido.
**Migration**: Los usuarios existentes que ya confirmaron su email no se ven afectados. Los nuevos usuarios se registran sin necesidad de confirmación.

### Requirement: Autenticación local (sin Supabase)
**Reason**: Se migra a Supabase Auth para centralizar autenticación y aprovechar infraestructura existente.
**Migration**: Usuarios existentes deben re-registrarse via Supabase Auth con sus emails autorizados.

---

## Delta from change: complete-system-audit-remediation

## MODIFIED Requirements

### Requirement: Supabase Auth Integration
The system SHALL integrate Supabase Auth for user authentication. **ADDED**: The system SHALL enforce server-side JWT verification and use the anon key with RLS instead of service_role.

#### Scenario: Server-side JWT verification
- **WHEN** a request includes a Supabase JWT
- **THEN** the server SHALL verify it using Supabase's JWT secret
- **AND** SHALL NOT accept tokens from `req.body.userId`

#### Scenario: RLS enforcement
- **WHEN** the backend queries Supabase
- **THEN** it SHALL use the anon key for client-facing operations
- **AND** RLS policies SHALL enforce row-level access control

#### Scenario: Service role restriction
- **WHEN** admin operations are needed
- **THEN** the service_role key SHALL only be used in admin/migration contexts
- **AND** SHALL NOT be used for regular API endpoints

## ADDED Requirements

### Requirement: User Identity in Requests
The system SHALL extract user identity from JWT tokens.

#### Scenario: Authenticated request
- **WHEN** a valid JWT is present
- **THEN** `req.user` SHALL contain the user's ID and email
- **AND** downstream handlers SHALL use `req.user.id`

#### Scenario: Anonymous request
- **WHEN** no JWT is present
- **AND** the endpoint allows anonymous access
- **THEN** `req.user` SHALL be null
- **AND** the handler SHALL treat it as anonymous
