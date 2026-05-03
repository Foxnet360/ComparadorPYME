## 1. Configuración Inicial

- [ ] 1.1 Verificar acceso a GitHub repo settings
- [ ] 1.2 Verificar acceso a Railway dashboard
- [ ] 1.3 Confirmar estructura actual del proyecto

## 2. Crear Skill "modificacion"

- [ ] 2.1 Crear directorio .opencode/skills/modificacion/
- [ ] 2.2 Crear SKILL.md con flujo completo
- [ ] 2.3 Incluir verificaciones de seguridad
- [ ] 2.4 Incluir integración con OpenSpec
- [ ] 2.5 Probar skill localmente

## 3. Configurar Branch Protection

- [ ] 3.1 Ir a GitHub repo → Settings → Branches
- [ ] 3.2 Crear rule para rama main
- [ ] 3.3 Habilitar "Require pull request reviews before merging" (si aplica)
- [ ] 3.4 Habilitar "Require status checks to pass before merging" (opcional)
- [ ] 3.5 Deshabilitar "Allow force pushes"
- [ ] 3.6 Deshabilitar "Allow deletions"

## 4. Documentar Flujo

- [ ] 4.1 Crear CONTRIBUTING.md en raíz
- [ ] 4.2 Documentar paso a paso el flujo de trabajo
- [ ] 4.3 Incluir ejemplos de comandos git
- [ ] 4.4 Incluir troubleshooting común
- [ ] 4.5 Actualizar README.md con referencia

## 5. Configurar Railway (si es necesario)

- [ ] 5.1 Verificar que Railway deploya solo desde main
- [ ] 5.2 Confirmar auto-deploy está activo para main
- [ ] 5.3 Verificar variables de entorno están configuradas

## 6. Prueba Integral

- [ ] 6.1 Crear rama feature de prueba
- [ ] 6.2 Hacer cambio menor
- [ ] 6.3 Verificar que push a feature/* no deploya
- [ ] 6.4 Mergear a main
- [ ] 6.5 Verificar que Railway deploya automáticamente
- [ ] 6.6 Verificar que aplicación funciona en producción
