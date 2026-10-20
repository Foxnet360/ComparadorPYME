# Configuración de Branch Protection

## Objetivo

Proteger la rama `main` para evitar pushes accidentales que rompan producción.

## Instrucciones Paso a Paso

### 1. Ir a GitHub Repository Settings

1. Abrir [github.com](https://github.com)
2. Navegar al repositorio: `Foxnet360/ComparadorPYME`
3. Click en **Settings** (pestaña superior)
4. En el menú lateral, click en **Branches**

### 2. Crear Branch Protection Rule

Click en **Add rule** (botón verde)

### 3. Configurar la Regla

**Branch name pattern:** `main`

#### Protect matching branches

Marcar las siguientes opciones:

- [x] **Restrict pushes that create files larger than 100MB**
  - Evita archivos muy grandes

- [x] **Require a pull request before merging** (OPCIONAL)
  - Si eres el único desarrollador, puedes dejar esto desmarcado
  - Si prefieres más control, marcado para forzar PRs

- [x] **Require status checks to pass before merging** (OPCIONAL)
  - Solo si configuras GitHub Actions o CI
  - Por ahora puedes dejarlo desmarcado

- [x] **Require branches to be up to date before merging**
  - Asegura que no haya conflictos

- [x] **Require conversation resolution before merging**
  - Asegura que todos los comentarios estén resueltos

- [x] **Require signed commits** (OPCIONAL)
  - Mayor seguridad, pero más complejo

- [x] **Include administrators**
  - Aplica las reglas también a ti (admin)

#### Rules applied to everyone including administrators

- [x] **Allow force pushes**
  - **DESMARCAR** ❌ (peligroso)

- [x] **Allow deletions**
  - **DESMARCAR** ❌ (peligroso)

### 4. Guardar

Click en **Create** o **Save changes**

## Verificación

Después de configurar, intenta hacer push directo a main:

```bash
git checkout main
echo "test" > test.txt
git add test.txt
git commit -m "test"
git push origin main
```

**Debería fallar con error:**
```
remote: error: GH006: Protected branch update failed...
remote: error: You're not authorized to push to this branch...
```

## Solución de Problemas

### "No veo la opción Settings"
**Causa:** No eres owner del repositorio
**Solución:** Verificar que eres el propietario de `Foxnet360/ComparadorPYME`

### "Puedo hacer push a pesar de la protección"
**Causa:** "Include administrators" no está marcado
**Solución:** Editar la regla y marcar "Include administrators"

### "Necesito hacer hotfix urgente"
**Solución temporal:**
1. Ir a Settings → Branches
2. Desactivar temporalmente la regla
3. Hacer el hotfix
4. Reactivar la regla inmediatamente

**Mejor solución:** Usar ramas `hotfix/*` y mergear rápidamente

## Diagrama de Seguridad

```
┌─────────────────────────────────────────┐
│           BRANCH PROTECTION             │
├─────────────────────────────────────────┤
│                                         │
│   feature/* ──▶ PR/Merge ──▶ main       │
│        │                        │       │
│        │                        │       │
│        ▼                        ▼       │
│   Desarrollo              Producción    │
│   (libre)                 (protegida)   │
│                                         │
└─────────────────────────────────────────┘
```

## Notas

- Las ramas `feature/*` NO están protegidas
- Puedes hacer push libremente a ramas feature
- Solo `main` requiere el proceso de merge
- Railway deploya automáticamente desde `main`

## Contacto

Si tienes problemas con la configuración, revisar:
- [GitHub Docs: Managing a branch protection rule](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)
- [CONTRIBUTING.md](CONTRIBUTING.md)
