# Guía del Broker - Selector de Clausulados

## Visión General

El nuevo selector de clausulados permite a los brokers seleccionar múltiples documentos por aseguradora de forma intuitiva. Reemplaza el sistema anterior con una interfaz organizada por aseguradora y tipo de documento.

## Acceso al Selector

1. Iniciar nueva auditoría en Comparador CSA
2. En la sección "Clausulados", seleccionar modo **Biblioteca**
3. El selector muestra todos los clausulados disponibles

## Interfaz del Selector

### Vista por Aseguradora

Los documentos se organizan en secciones colapsables:

```
▶ AXA COLPATRIA (3)
▶ MAPFRE (2)
▼ BBVA (4)
  [✓] Clausulado General - v2024.1 [General]
  [✓] Clausulado Particular - v2024.1 [Particular]
  [ ] Anexo Cobertura Adicional [Anexo]
  [ ] Cotización PYME [Cotización]
```

### Tipos de Documento

Cada documento muestra su tipo con un color distintivo:

| Tipo | Color | Descripción |
|------|-------|-------------|
| General | 🔵 Azul | Condiciones generales del seguro |
| Particular | 🟣 Púrpura | Condiciones particulares/cotización |
| Anexo | 🟠 Naranja | Coberturas o exclusiones adicionales |

### Información Mostrada

Por cada documento se visualiza:
- ✅ **Checkbox** para selección
- 📄 **Nombre** del documento
- 🏷️ **Versión** (ej: v2024.1)
- 📦 **Producto** (ej: Póliza PYME)
- ✅ **Estado** (Indexado/Disponible)

## Selección de Documentos

### Selección Individual

1. Expandir la aseguradora deseada (clic en ▶)
2. Marcar el checkbox del documento específico
3. El documento se añade a la selección

### Selección Múltiple por Aseguradora

1. Expandir la aseguradora
2. Clic en el checkbox del **header** de la aseguradora
3. Se seleccionan/deseleccionan **todos** los documentos de esa aseguradora

### Selección Mixta

Puedes seleccionar documentos de diferentes tipos para la misma aseguradora:

```
✅ AXA COLPATRIA
   [✓] Clausulado General PYME v2024.2
   [✓] Clausulado Particular PYME v2024.2
   [✓] Anexo - Cobertura Terremoto
   
✅ MAPFRE
   [✓] Clausulado General PYME v2024.1
   [ ] Anexo - Robo y Hurto
```

## Confirmación de Selección

Al seleccionar documentos, aparece un resumen:

```
✓ 5 documentos seleccionados
```

Esta selección se usará durante el análisis de la auditoría.

## Modos de Operación

### Modo Biblioteca (Recomendado)

- Muestra clausulados pre-indexados por administración
- Documentos persistentes (no se pierden al reiniciar)
- Múltiples documentos por aseguradora
- Versionado automático (siempre usa versión activa)

### Modo Subir Archivos

- Para casos donde no existe el clausulado en biblioteca
- Arrastrar o seleccionar PDFs directamente
- Los archivos se indexan en tiempo real
- Útil para cotizaciones nuevas o aseguradoras no configuradas

**Para cambiar de modo:**
1. Clic en pestaña "Subir archivos"
2. Arrastrar PDFs al área indicada
3. Clic en "Biblioteca" para volver al modo normal

## Flujo de Trabajo Típico

```
1. Crear nueva auditoría
   ↓
2. Seleccionar modo "Biblioteca"
   ↓
3. Expandir aseguradoras de interés
   ↓
4. Seleccionar clausulados relevantes:
      - General (obligatorio)
      - Particular (si aplica)
      - Anexos (si aplica)
   ↓
5. Verificar contador: "X documentos seleccionados"
   ↓
6. Continuar con carga de cotizaciones
   ↓
7. Ejecutar análisis
```

## Casos de Uso

### Caso 1: Comparación Básica (2 aseguradoras)

```
✅ AXA COLPATRIA
   [✓] Clausulado General PYME v2024.2
   
✅ MAPFRE
   [✓] Clausulado General PYME v2024.1
```

### Caso 2: Comparación Completa (Con anexos)

```
✅ AXA COLPATRIA
   [✓] Clausulado General PYME v2024.2
   [✓] Anexo - Cobertura Terremoto
   
✅ BBVA
   [✓] Clausulado General PYME v2024.1
   [✓] Anexo - Cobertura Terremoto
   [✓] Anexo - Asistencia Jurídica
```

### Caso 3: Cotización Nueva (No en biblioteca)

```
1. Cambiar a modo "Subir archivos"
2. Arrastrar PDF de cotización
3. El sistema indexa automáticamente
4. Continuar con auditoría
```

## Preguntas Frecuentes

### ¿Por qué no veo cierta aseguradora?

**Causas:**
- Los clausulados no han sido cargados por administración
- Los documentos están archivados (versión antigua)
- Filtro activo ocultando resultados

**Solución:** Contactar al administrador para cargar los clausulados faltantes.

### ¿Puedo seleccionar múltiples versiones del mismo documento?

**No.** El sistema siempre muestra la **versión activa** más reciente. Las versiones archivadas están disponibles solo para consulta histórica en el panel de administración.

### ¿Qué pasa si subo un archivo en modo "Subir archivos"?

El archivo se indexa en tiempo real y queda disponible para la auditoría actual. Sin embargo, para que persista en futuras auditorías, el administrador debe cargarlo formalmente vía ClauseAdmin o seed script.

### ¿Los documentos seleccionados afectan el análisis?

**Sí.** El sistema RAG (Recuperación de Información) usa los documentos seleccionados para:
- Comparar coberturas entre aseguradoras
- Verificar exclusiones y deducibles
- Generar recomendaciones

### ¿Puedo cambiar mi selección después de iniciar?

**Sí**, mientras no se haya ejecutado el análisis final. Una vez generado el reporte, se requiere crear una nueva auditoría para cambiar los clausulados.

## Mejores Prácticas

### Selección Recomendada

Para una auditoría completa, seleccionar:
1. ✅ **Clausulado General** (obligatorio)
2. ✅ **Clausulado Particular** (si hay cotización específica)
3. ✅ **Anexos** (si aplican a la cotización)

### Evitar

- ❌ Seleccionar solo cotizaciones sin clausulados generales
- ❌ Mezclar versiones muy antiguas (usar siempre la más reciente)
- ❌ Seleccionar documentos de aseguradoras no incluidas en la cotización

### Verificación Pre-Análisis

Antes de ejecutar el análisis, confirmar:
- [ ] Al menos 2 aseguradoras seleccionadas
- [ ] Clausulado General incluido para cada aseguradora
- [ ] Documentos corresponden a la misma línea de producto
- [ ] Versiones son las más recientes disponibles

## Atajos de Teclado

| Atajo | Acción |
|-------|--------|
| `Space` | Seleccionar/deseleccionar documento enfocado |
| `Enter` | Expandir/colapsar sección de aseguradora |
| `Ctrl+A` | Seleccionar todos los documentos visibles |

## Soporte

Para problemas con el selector de clausulados:
- Verificar que el servidor esté funcionando
- Recargar la página (F5)
- Contactar al administrador del sistema
- Reportar issue: https://github.com/anomalyco/opencode/issues