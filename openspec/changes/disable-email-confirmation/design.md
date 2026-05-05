## Context

El sistema utiliza Supabase Auth para autenticación con email/password. Actualmente está configurado con confirmación por email habilitada, lo que significa que cada vez que un usuario se registra, Supabase intenta enviar un email de confirmación. En el plan gratuito de Supabase, existe un límite estricto de emails (~3 por hora), lo que causa errores 429 y bloquea completamente el registro de nuevos usuarios.

Estado actual:
- `services/authService.ts` valida `email_confirmed_at` antes de permitir login
- `components/RegisterScreen.tsx` muestra mensaje indicando que se envió email de confirmación
- Supabase Auth tiene "Enable email confirmations" activado en el dashboard

## Goals / Non-Goals

**Goals:**
- Permitir registro de usuarios sin depender de envío de emails
- Eliminar errores 429 durante el registro
- Mantener la autenticación segura sin confirmación por email
- Mejorar la experiencia de usuario con registro instantáneo

**Non-Goals:**
- No migrar a otro proveedor de autenticación
- No implementar sistema SMTP propio (de momento)
- No agregar nuevos métodos de autenticación (OAuth, etc.)
- No modificar la lógica de roles ni permisos

## Decisions

### 1. Desactivar confirmación en Supabase (no en código)
**Decisión:** Desactivar "Enable email confirmations" desde el dashboard de Supabase en lugar de modificar parámetros en el código.

**Rationale:**
- Es la forma estándar y soportada de Supabase para este comportamiento
- No requiere cambios en la llamada a `supabase.auth.signUp()`
- Fácil de revertir si en el futuro se configura SMTP propio
- Evita enviar emails innecesarios que consumen el límite del plan gratuito

**Alternativas consideradas:**
- Modificar `authService.signUp()` para pasar opciones que eviten email → Menos limpio, no estándar
- Usar Service Role Key para crear usuarios directamente → Más complejo, menos seguro

### 2. Eliminar validación de email_confirmed_at
**Decisión:** Quitar la verificación `!data.user.email_confirmed_at` en `authService.signIn()`.

**Rationale:**
- Si desactivamos confirmaciones, todos los usuarios nuevos tendrán `email_confirmed_at = null`
- Mantener esta validación bloquearía el login de usuarios registrados después del cambio
- Los usuarios existentes confirmados siguen funcionando normalmente

**Impacto:**
- Líneas 54-57 de `services/authService.ts` se eliminan
- El flujo de login se simplifica

### 3. No implementar auto-login (fase 1)
**Decisión:** En esta primera fase, después del registro exitoso, mostrar mensaje de éxito y pedir al usuario que inicie sesión manualmente.

**Rationale:**
- Cambio más seguro y controlado
- Permite verificar que el flujo de registro funciona correctamente antes de agregar complejidad
- El usuario puede revisar sus datos antes de iniciar sesión

**Futuro:** Considerar auto-login en fase 2 si la UX lo requiere.

## Risks / Trade-offs

**Riesgo: Seguridad reducida**
- Sin confirmación por email, cualquiera puede registrarse con cualquier email (incluso emails que no le pertenecen)
- **Mitigación:** En MVP es aceptable. Para producción a largo plazo, considerar:
  - Implementar SMTP propio (SendGrid, AWS SES) para reactivar confirmaciones
  - Agregar validación de email en el backend antes de crear cuenta
  - Implementar rate limiting en el endpoint de registro

**Riesgo: Emails no verificados en base de datos**
- Los usuarios pueden haber ingresado emails con errores tipográficos
- **Mitigación:** Agregar opción de "cambiar email" en el perfil de usuario

**Riesgo: No poder recuperar contraseña**
- Si el usuario ingresó un email incorrecto, no podrá recibir el email de recuperación
- **Mitigación:** Considerar que esto es un riesgo aceptable para MVP. En el futuro, agregar confirmación de email al cambiar dirección.

## Migration Plan

### Paso 1: Configuración en Supabase Dashboard (antes del deploy)
1. Ir a https://supabase.com/dashboard → Proyecto → Authentication → Email
2. Desactivar "Enable email confirmations"
3. Guardar cambios

### Paso 2: Deploy de código (después de la config)
1. Eliminar validación `email_confirmed_at` en `services/authService.ts`
2. Actualizar mensaje en `authService.signUp()`
3. Actualizar UI en `RegisterScreen.tsx` si es necesario
4. Hacer commit y push
5. Deploy en Railway

### Rollback (si es necesario)
1. Revertir commit de código
2. Reactivar "Enable email confirmations" en Supabase
3. Los usuarios registrados durante el período sin confirmación pueden necesitar ser confirmados manualmente o re-registrarse

## Open Questions

1. ¿Cuántos usuarios existentes tienen email no confirmado que podrían verse afectados?
2. ¿Se necesita alguna validación adicional en el backend antes de crear cuenta?
3. ¿Cuándo se planea implementar SMTP propio para reactivar confirmaciones?
