## ADDED Requirements

### Requirement: Sincronizar correcciones de usuario con el reporte global
El sistema DEBE propagar inmediatamente cualquier edición o corrección realizada por el usuario en `CorrectionUI` hacia la estructura del reporte global `ComparisonReport`.

#### Scenario: Edición de valor en matriz por el usuario
- **WHEN** el usuario realiza una modificación en una cobertura o deducible mediante `CorrectionUI`
- **THEN** el sistema actualiza la propiedad correspondiente en el objeto `report` del estado global y recalcula dinámicamente los valores visibles en la matriz y el reporte ejecutivo.

#### Scenario: Generación de PDF con correcciones aplicadas
- **WHEN** el usuario exporta el reporte a PDF luego de haber aplicado correcciones manuales
- **THEN** la exportación PDF generada DEBE incluir los valores corregidos por el usuario en lugar de los valores originales extraídos por la IA.
