## ADDED Requirements

### Requirement: Toggle entre vistas de coberturas
El sistema DEBE proporcionar un toggle para cambiar entre diferentes vistas de presentación de coberturas no categorizadas.

#### Scenario: Vista agrupada (default)
- **WHEN** se carga la sección de coberturas no categorizadas
- **THEN** se muestra la vista agrupada por similitud semántica por defecto

#### Scenario: Vista matriz
- **WHEN** el usuario selecciona "Vista Comparativa"
- **THEN** se muestra la vista en formato matriz con aseguradoras como columnas

#### Scenario: Persistencia de preferencia
- **WHEN** el usuario cambia de vista
- **THEN** la preferencia se mantiene durante la sesión

### Requirement: Sticky headers en tablas comparativas
Las tablas comparativas DEBEN tener headers sticky para facilitar la navegación.

#### Scenario: Sticky column header
- **WHEN** la tabla tiene scroll horizontal
- **THEN** la primera columna (nombres/categorías) permanece visible (sticky left)

#### Scenario: Sticky row header
- **WHEN** la tabla tiene scroll vertical
- **THEN** la fila de headers de aseguradoras permanece visible (sticky top)

### Requirement: Responsive design
Las vistas DEBEN adaptarse a diferentes tamaños de pantalla.

#### Scenario: Vista móvil
- **WHEN** la pantalla es menor a 768px
- **THEN** las tablas permiten scroll horizontal y las cards se apilan verticalmente

#### Scenario: Vista desktop
- **WHEN** la pantalla es mayor a 1024px
- **THEN** se muestra la tabla completa con todas las columnas visibles
