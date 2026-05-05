# Procedimiento de Rollback - Librería de Clausulados

## Visión General

Este documento describe cómo revertir cambios en caso de problemas con el nuevo sistema de librería de clausulados versionada.

## Escenarios de Rollback

### Escenario 1: Rollback de Versión de Documento

**Cuándo usar:** Se subió una versión incorrecta y se quiere restaurar la anterior.

**Procedimiento:**

1. **Identificar documentos afectados**
   ```sql
   SELECT id, document_name, version, is_active, created_at
   FROM documents
   WHERE insurer_id = 'UUID_ASEGURADORA'
   ORDER BY created_at DESC;
   ```

2. **Archivar versión incorrecta (si está activa)**
   ```sql
   UPDATE documents
   SET is_active = false,
       updated_at = NOW()
   WHERE id = 'UUID_VERSION_INCORRECTA';
   ```

3. **Reactivar versión anterior**
   ```sql
   UPDATE documents
   SET is_active = true,
       updated_at = NOW()
   WHERE id = 'UUID_VERSION_ANTERIOR';
   ```

4. **Verificar estado**
   ```sql
   SELECT document_name, version, is_active
   FROM documents
   WHERE insurer_id = 'UUID_ASEGURADORA'
   ORDER BY created_at DESC;
   ```

**Nota:** Solo puede haber UNA versión activa por combinación (insurer_id, document_type, product_name).

### Escenario 2: Rollback Completo del Sistema

**Cuándo usar:** El nuevo sistema tiene errores críticos y se necesita volver al sistema legacy.

**⚠️ ADVERTENCIA:** Este procedimiento es destructivo. Solo ejecutar con autorización del equipo técnico.

**Procedimiento:**

1. **Crear backup de la base de datos actual**
   ```bash
   # Usar herramienta de backup de Supabase
   # o exportar datos críticos
   ```

2. **Restaurar controllers legacy**
   
   Si se eliminaron los archivos:
   ```bash
   # Restaurar desde git
   git checkout main -- server/src/controllers/ragClauseController.ts
   git checkout main -- server/src/controllers/clauseController.ts
   ```

3. **Restaurar endpoints en server/src/index.ts**
   ```typescript
   // Agregar imports
   import { ragClauseController } from './controllers/ragClauseController';
   import { clauseController } from './controllers/clauseController';
   
   // Agregar rutas (ANTES de las rutas de documentos)
   app.post('/api/rag/clauses', upload.single('file'), ragClauseController.indexClause);
   app.get('/api/rag/clauses', ragClauseController.listClauses);
   app.delete('/api/rag/clauses', ragClauseController.deleteClause);
   ```

4. **Restaurar frontend**
   ```bash
   # Revertir cambios en componentes
   git checkout main -- components/ClauseAdmin.tsx
   git checkout main -- components/ClauseSelector.tsx
   git checkout main -- services/clauseService.ts
   ```

5. **Redeploy**
   ```bash
   npm run build
   npm run deploy
   ```

### Escenario 3: Eliminación Accidental de Documento

**Cuándo usar:** Se eliminó un documento por error desde ClauseAdmin.

**Procedimiento:**

1. **Verificar si existe backup**
   - Los documentos eliminados con `DELETE /api/documents/:id` eliminan también:
     - Registro en tabla `documents`
     - Chunks asociados en tabla `chunks`
     - Imágenes en storage
   
2. **Si no hay backup:**
   - Re-subir el documento original
   - El sistema creará nueva versión (auto-archive si hay versión activa)

3. **Restaurar desde backup (si existe)**
   ```sql
   -- Restaurar desde backup de Supabase
   -- Contactar administrador de base de datos
   ```

## Prevención de Problemas

### Antes de Subir Nueva Versión

1. **Verificar documento**
   - [ ] PDF tiene texto seleccionable
   - [ ] Es la versión correcta
   - [ ] Metadatos (producto, tipo) son correctos

2. **Revisar versiones existentes**
   - Ir a ClauseAdmin
   - Filtrar por la aseguradora
   - Verificar versión activa actual

3. **Notificar al equipo**
   - Avisar a brokers sobre nueva versión
   - Documentar cambios en versión

### Backup Automático

Recomendaciones:
- **Supabase**: Configurar backups automáticos diarios
- **Git**: Commits frecuentes en feature branches
- **Documentos**: Mantener copias locales de PDFs originales

## Procedimientos de Emergencia

### Fallo Crítico en Producción

```
1. DETENER deploys nuevos inmediatamente
2. Evaluar severidad:
   a. Si es bug aislado → Rollback de versión (Escenario 1)
   b. Si es fallo sistémico → Rollback completo (Escenario 2)
3. Notificar al equipo vía canal de emergencias
4. Documentar incidente
5. Planificar fix y re-deploy
```

### Contactos de Emergencia

| Rol | Contacto | Escenario |
|-----|----------|-----------|
| Tech Lead | [Email/Slack] | Rollback completo |
| DBA | [Email/Slack] | Problemas de base de datos |
| Product Owner | [Email/Slack] | Decisión de negocio |

## Checklist Pre-Deploy

Antes de implementar cambios en producción:

- [ ] Tests pasan en staging
- [ ] Backup de base de datos actualizado
- [ ] Rollback procedure revisado por 2+ developers
- [ ] Feature flag configurado (si aplica)
- [ ] Monitoreo activo para detectar errores temprano
- [ ] Plan de comunicación al equipo definido

## Historial de Cambios

| Fecha | Versión | Cambio | Autor |
|-------|---------|--------|-------|
| 2026-05-05 | 1.0 | Documento inicial | Sistema |

## Notas

- Los documentos archivados (`is_active = false`) **NO** se eliminan físicamente
- Siempre existe la opción de reactivar una versión archivada
- El procedimiento de rollback completo debería automatizarse con scripts
- Considerar implementar "soft delete" con periodo de gracia (30 días) antes de eliminación física