## ADDED Requirements

### Requirement: Resumen estructurado automático de deducibles
El sistema DEBE extraer automáticamente información estructurada de los textos de deducibles y mostrarla en formato comparativo.

#### Scenario: Extracción de porcentajes
- **WHEN** el texto de deducibles contiene "10%"
- **THEN** el resumen muestra "10%" en la columna correspondiente

#### Scenario: Extracción de mínimos SMMLV
- **WHEN** el texto contiene "Mínimo: 5 SMMLV"
- **THEN** el resumen muestra "Mín: 5 SMMLV" en la columna correspondiente

#### Scenario: Identificación de tipo de deducible
- **WHEN** el texto menciona "sobre el valor asegurado"
- **THEN** se muestra una alerta visual (🔴) indicando que es sobre valor asegurado

#### Scenario: Identificación de sobre pérdida
- **WHEN** el texto menciona "sobre la pérdida"
- **THEN** se muestra un indicador visual (🟢) indicando que es sobre pérdida

### Requirement: Tabla comparativa de deducibles
El sistema DEBE mostrar los deducibles extraídos en una tabla comparativa lado-a-lado por aseguradora.

#### Scenario: Comparación por categoría
- **WHEN** se visualizan los deducibles
- **THEN** se muestra una tabla con categorías como filas y aseguradoras como columnas

#### Scenario: Destacar diferencias
- **WHEN** dos aseguradoras tienen diferentes deducibles para la misma categoría
- **THEN** las celdas resaltan visualmente las diferencias

### Requirement: Texto completo colapsable
El sistema DEBE mantener el texto original de deducibles accesible pero oculto por defecto.

#### Scenario: Texto colapsado por defecto
- **WHEN** se carga la vista de deducibles
- **THEN** el texto completo está colapsado y solo se ve el resumen estructurado

#### Scenario: Expandir texto
- **WHEN** el usuario hace clic en "Ver texto completo"
- **THEN** se expande mostrando el texto original de la aseguradora

#### Scenario: Formato preservado
- **WHEN** se muestra el texto completo expandido
- **THEN** mantiene el formato original (saltos de línea, párrafos)
