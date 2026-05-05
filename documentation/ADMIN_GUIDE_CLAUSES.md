# Guía de Administración - Subida de Clausulados

## Acceso al Panel de Administración

1. Navegar a la aplicación Comparador CSA
2. Abrir el panel **ClauseAdmin** (Librería de Clausulados)
3. Se requieren permisos de administrador

## Subir un Nuevo Documento

### Paso 1: Preparar el Archivo

- **Formato**: Solo archivos PDF
- **Tamaño máximo**: 50MB
- **Calidad recomendada**: PDF con texto seleccionable (no escaneados)

### Paso 2: Completar el Formulario

En el panel "Subir Nuevo Documento":

| Campo | Requerido | Descripción | Ejemplo |
|-------|-----------|-------------|---------|
| **Aseguradora** | Sí | Nombre exacto de la aseguradora | `AXA COLPATRIA` |
| **Nombre Documento** | Sí | Nombre descriptivo | `Clausulado General PYME` |
| **Tipo** | Sí | Tipo de documento | `Clausulado General` |
| **Producto** | No | Nombre del producto/ramo | `Póliza PYME` |
| **Versión** | No | Identificador de versión | `2024.1` |
| **Archivo PDF** | Sí | Archivo a subir | `clausulado.pdf` |

### Paso 3: Enviar

1. Hacer clic en **Subir**
2. Esperar procesamiento (extracción de texto, chunks, embeddings)
3. Verificar mensaje de éxito

## Comportamiento de Versionado

### Primera Subida

- El documento se marca como **Activo**
- No hay versiones anteriores

### Subida de Nueva Versión

Cuando subes un documento con la misma combinación de:
- Aseguradora + Tipo + Producto

El sistema automáticamente:
1. **Archiva** la versión anterior (estado = Archivado)
2. **Activa** la nueva versión
3. Muestra ambos documentos en la tabla

**Ejemplo:**
```
Subida 1: AXA + General + "PYME" v2024.1 → Activo
Subida 2: AXA + General + "PYME" v2024.2 → Activo
                                    v2024.1 → Archivado (automático)
```

## Gestión de Documentos

### Filtros Disponibles

- **Todas las aseguradoras**: Ver documentos de todas las aseguradoras
- **Estado**:
  - *Todos*: Activos y archivados
  - *Solo Activos*: Solo visibles en búsquedas RAG
  - *Solo Archivados*: Versiones anteriores

### Acciones por Documento

| Acción | Descripción |
|--------|-------------|
| 📋 **Versiones** | Ver historial de versiones de la aseguradora |
| 🗑️ **Eliminar** | Eliminar permanentemente el documento (incluyendo chunks) |

### Visualización de Estados

- 🟢 **Activo**: Visible en búsquedas RAG, disponible para selección
- ⚪ **Archivado**: Conservado pero excluido de búsquedas

## Carga Masiva Inicial

Para cargar múltiples clausulados (ej: migración inicial de 24 aseguradoras):

### Opción 1: Script Interactivo

```bash
npm run seed:clauses
```

El script:
1. Escanea el directorio `/Ejemplos/`
2. Pregunta metadatos por cada archivo
3. Indexa automáticamente

### Opción 2: Manifest Batch

1. Generar manifest de ejemplo:
```bash
npm run seed:clauses -- --generate-manifest
```

2. Editar `manifest-example.json` con los metadatos correctos

3. Ejecutar en batch:
```bash
npm run seed:clauses -- --manifest=manifest.json
```

4. Para reanudar si se interrumpe:
```bash
npm run seed:clauses -- --manifest=manifest.json --resume
```

## Mejores Prácticas

### Nomenclatura

- **Aseguradoras**: Usar nombre oficial en MAYÚSCULAS
  - ✅ `AXA COLPATRIA`
  - ✅ `MAPFRE SEGUROS`
  - ❌ `axa`, `Axa Colpatria`

- **Productos**: Ser específico
  - ✅ `Póliza PYME Básica`
  - ✅ `Seguro Empresarial Premium`
  - ❌ `General`, `Producto 1`

- **Versiones**: Usar formato consistente
  - ✅ `2024.1`, `2024.2`, `2025.1`
  - ❌ `v1`, `latest`, `nueva`

### Documentos por Aseguradora

Una aseguradora puede tener múltiples documentos activos simultáneamente:

```
AXA COLPATRIA
├── Clausulado General - "PYME" (Activo)
├── Clausulado Particular - "PYME" (Activo)
├── Anexo - "Cobertura Adicional" (Activo)
└── Cotización - "PYME" (Activo)
```

### Frecuencia de Actualización

- **Cambios menores**: Subir nueva versión (sistema archiva automáticamente)
- **Cambios mayores**: Considerar crear nuevo producto si cambia el ramo
- **Retención**: Las versiones archivadas se mantienen indefinidamente

## Solución de Problemas

### Error: "Document already exists"

**Causa**: Ya existe un documento activo con la misma combinación aseguradora+tipo+producto

**Solución**: El sistema archivará automáticamente la versión anterior. Esto es el comportamiento esperado.

### Error: "Failed to index document"

**Causas comunes**:
- PDF está protegido con contraseña
- PDF es una imagen escaneada sin OCR
- Error de conectividad con Supabase

**Solución**:
1. Verificar que el PDF tenga texto seleccionable
2. Reintentar la subida
3. Contactar soporte técnico si persiste

### Documento aparece como Archivado inmediatamente

**Causa**: Se subió una nueva versión del mismo producto+tipo

**Solución**: Verificar que se quiere subir una nueva versión. Si fue un error, eliminar el documento nuevo y reactivar el anterior (requiere acceso directo a DB).

## Flujo de Trabajo Típico

```
1. Recibir nuevo clausulado de aseguradora
   ↓
2. Verificar si es nueva versión o nuevo producto
   ↓
3. Subir vía ClauseAdmin o seed script
   ↓
4. Verificar en tabla que aparece como "Activo"
   ↓
5. Notificar a brokers que hay nueva versión disponible
   ↓
6. (Opcional) Eliminar versiones muy antiguas si ocupan espacio
```

## Contacto y Soporte

Para problemas técnicos con la carga de clausulados:
- Crear issue en: https://github.com/anomalyco/opencode/issues
- Asunto: `[Clause Upload] <descripción del problema>`