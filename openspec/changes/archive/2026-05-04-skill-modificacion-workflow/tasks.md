## 1. Configuración Inicial

- [x] 1.1 Verificar acceso a GitHub repo settings
- [x] 1.2 Verificar acceso a Railway dashboard
- [x] 1.3 Confirmar estructura actual del proyecto

## 2. Crear Skill "modificacion"

- [x] 2.1 Crear directorio .opencode/skills/modificacion/
- [x] 2.2 Crear SKILL.md con flujo completo
- [x] 2.3 Incluir verificaciones de seguridad
- [x] 2.4 Incluir integración con OpenSpec
- [x] 2.5 Probar skill localmente

## 3. Configurar Branch Protection

- [x] 3.1 Ir a GitHub repo → Settings → Branches
- [x] 3.2 Crear rule para rama main
- [x] 3.3 Habilitar "Require pull request reviews before merging" (si aplica)
- [x] 3.4 Habilitar "Require status checks to pass before merging" (opcional)
- [x] 3.5 Deshabilitar "Allow force pushes"
- [x] 3.6 Deshabilitar "Allow deletions"

## 4. Documentar Flujo

- [x] 4.1 Crear CONTRIBUTING.md en raíz
- [x] 4.2 Documentar paso a paso el flujo de trabajo
- [x] 4.3 Incluir ejemplos de comandos git
- [x] 4.4 Incluir troubleshooting común
- [x] 4.5 Actualizar README.md con referencia

## 5. Configurar Railway (si es necesario)

- [x] 5.1 Verificar que Railway deploya solo desde main
- [x] 5.2 Confirmar auto-deploy está activo para main
- [x] 5.3 Verificar variables de entorno están configuradas

## 6. Prueba Integral

- [x] 6.1 Crear rama feature de prueba
- [x] 6.2 Hacer cambio menor
- [x] 6.3 Verificar que push a feature/* no deploya
- [x] 6.4 Mergear a main
- [x] 6.5 Verificar que Railway deploya automáticamente
- [x] 6.6 Verificar que aplicación funciona en producción
