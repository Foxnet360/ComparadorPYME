## Why

El sistema actual requiere confirmación por email para nuevos registros, lo que causa errores 429 (rate limit exceeded) del plan gratuito de Supabase después de solo 3 registros por hora. Esto bloquea completamente el registro de nuevos usuarios y afecta la experiencia del usuario. Necesitamos desactivar las confirmaciones por email para permitir registros fluidos y sin fricción.

## What Changes

- **Desactivar confirmación por email** en configuración de Supabase Auth
- **Eliminar validación de email confirmado** en `authService.signIn()` (líneas 54-57)
- **Actualizar mensaje de registro exitoso** en `authService.signUp()` para reflejar que no se requiere confirmación
- **Opcional: Implementar auto-login** después del registro exitoso para mejorar UX
- **Modificar `supabase-auth` spec** para reflejar el nuevo flujo sin confirmación por email

## Capabilities

### New Capabilities
*No hay nuevas capacidades. Este es un cambio de configuración y comportamiento existente.*

### Modified Capabilities
- `supabase-auth`: El requisito de confirmación por email se elimina. El flujo de registro cambia: ya no se envía email de confirmación y el usuario puede iniciar sesión inmediatamente después del registro.

## Impact

- **Código:** `services/authService.ts` (validación de email confirmado)
- **Código:** `components/RegisterScreen.tsx` (mensajes y flujo post-registro)
- **Configuración:** Dashboard de Supabase → Authentication → Email (desactivar "Enable email confirmations")
- **Seguridad:** Los usuarios podrán registrarse sin verificar email (aceptable para MVP, considerar re-implementar en futuro con SMTP propio)
- **UX:** Mejora significativa - registro instantáneo sin esperar email
