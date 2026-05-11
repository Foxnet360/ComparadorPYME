## ADDED Requirements

### Requirement: Tesauro disponible en producción Docker
Los archivos de tesauro DEBEN estar accesibles en el entorno de producción Docker/Railway para que el servicio de mapeo semántico funcione correctamente.

#### Scenario: Tesauro carga en Railway
- **WHEN** la aplicación se inicia en Railway
- **THEN** el servicio encuentra y carga `tesauro(pyme).md` y `tesauro-extensiones.md`
- **AND** no muestra el mensaje "Thesaurus file not found, using built-in thesaurus"

#### Scenario: Fallback a tesauro built-in
- **WHEN** los archivos de tesauro no están disponibles
- **THEN** el sistema usa el tesauro built-in como fallback
- **AND** registra un warning en los logs

#### Scenario: Verificación post-deploy
- **WHEN** se ejecuta el script de verificación post-deploy
- **THEN** se confirma que los archivos de tesauro están en la ubicación esperada
- **AND** el tesauro se carga sin errores
