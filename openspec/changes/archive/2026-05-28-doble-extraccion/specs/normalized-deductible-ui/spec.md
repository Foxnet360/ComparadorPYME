## ADDED Requirements

### Requirement: Priorización de Deducibles Estructurados
El componente de visualización comparativa de deducibles MUST dar precedencia a la información normalizada estructurada sobre el texto original sin procesar.

#### Scenario: Visualización Limpia de Deducible Compuesto
- **WHEN** una cobertura posee un objeto deducible con campos `normalized` válidos (porcentaje y mínimos/máximos) y un campo `rawText`
- **THEN** la interfaz formatea y renderiza la cadena limpia (ej: `10%, min: $1.300.000 COP`) e inyecta la cadena limpia dentro del badge.

#### Scenario: Fallback a Texto Plano
- **WHEN** los campos `normalized` de un deducible están vacíos o no pudieron ser resueltos sintácticamente por el backend
- **THEN** la interfaz muestra el `rawText` original de manera segura sin interrumpir la renderización.

### Requirement: Tooltips Libres de Clipping
El tooltip informativo del badge de deducible MUST ser visible en su totalidad y no debe ser recortado por contenedores con barras de desplazamiento horizontal.

#### Scenario: Tooltip Visible en Extremos de Tabla
- **WHEN** el usuario pasa el mouse sobre un badge ubicado en la columna del extremo derecho de una tabla con `overflow-x-auto`
- **THEN** el tooltip se despliega en una capa visual superior (`z-50`) con posicionamiento relativo/fijo seguro, previniendo recortes y ocultamiento lateral.
