## MODIFIED Requirements

### Requirement: Control de acceso para usuarios
El sistema DEBE permitir el registro de nuevos usuarios sin confirmación por email.

#### Scenario: Registro sin confirmación
- **WHEN** un usuario completa el formulario de registro con email y password válidos
- **THEN** Supabase Auth crea la cuenta inmediatamente
- **AND** el usuario puede iniciar sesión sin esperar confirmación por email

## REMOVED Requirements

### Requirement: Confirmación por email
**Reason**: El plan gratuito de Supabase tiene un límite de ~3 emails por hora, lo que bloquea registros de nuevos usuarios. Se desactiva temporalmente para permitir registro fluido.
**Migration**: Los usuarios existentes que ya confirmaron su email no se ven afectados. Los nuevos usuarios se registran sin necesidad de confirmación.

#### Scenario: Usuario autorizado (REMOVIDO)
- **WHEN** un usuario con email autorizado completa el registro
- **THEN** Supabase Auth crea la cuenta
- **AND** el sistema envía email de confirmación
- **AND** al confirmar, el usuario puede acceder a la aplicación

## ADDED Requirements

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
