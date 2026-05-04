## ADDED Requirements

### Requirement: Skill interactivo de modificación
El sistema SHALL proporcionar un skill interactivo que guíe al desarrollador en el proceso completo de realizar modificaciones al proyecto.

#### Scenario: Iniciar modificación
- **WHEN** el desarrollador quiere hacer un cambio
- **THEN** el skill pregunta qué quiere modificar
- **AND** crea una rama feature/* automáticamente
- **AND** inicia un change de OpenSpec

#### Scenario: Verificar antes de mergear
- **WHEN** el desarrollador quiere integrar a main
- **THEN** el skill verifica que todo funciona localmente
- **AND** verifica que no hay errores en build
- **AND** permite el merge solo si todo está correcto

### Requirement: Branch protection en GitHub
El sistema SHALL proteger la rama main contra pushes accidentales.

#### Scenario: Push a main bloqueado
- **WHEN** un desarrollador intenta push directo a main
- **THEN** GitHub rechaza el push
- **AND** sugiere usar una rama feature/*

### Requirement: Flujo documentado
El sistema SHALL tener documentación clara del flujo de trabajo.

#### Scenario: Nuevo desarrollador (o recordatorio)
- **WHEN** alguien lee CONTRIBUTING.md
- **THEN** encuentra instrucciones paso a paso
- **AND** entiende el flujo feature → main → Railway
