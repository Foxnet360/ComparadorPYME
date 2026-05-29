# Spec: Interactive PDF Viewer

## Capability
Visor de PDF integrado en la interfaz de comparación que permite navegar directamente a páginas de evidencia y resaltar texto relevante, operando en múltiples modos según el viewport.

## User Story
**Como** analista técnico de seguros
**Quiero** ver el PDF original en la página exacta donde se encontró una cobertura
**Para** validar visualmente que la extracción de la IA es correcta

## ADDED Requirements

### Requirement: Visor PDF lateral en desktop
El sistema SHALL renderizar un visor de PDF en un panel deslizable lateral (drawer) cuando el usuario solicite ver evidencia de una celda en desktop.

#### Scenario: Abrir visor desde celda
- **WHEN** el usuario hace clic en "Ver Evidencia" o el número de página de una celda de cobertura
- **THEN** un panel lateral se desliza desde la derecha ocupando el 40% del ancho de pantalla
- **AND** el panel carga el PDF correspondiente a la cotización de esa celda
- **AND** el PDF se navega automáticamente a la página calculada (pageNumber o calculatedPage)

#### Scenario: Cerrar visor lateral
- **WHEN** el usuario hace clic en el botón de cerrar (X) o en el área oscurecida fuera del panel
- **THEN** el panel lateral se cierra con animación suave
- **AND** la matriz recupera el ancho completo

#### Scenario: Múltiples PDFs
- **WHEN** el usuario abre evidencia de una celda de otra cotización mientras el visor está abierto
- **THEN** el visor cambia al nuevo PDF y página sin cerrarse
- **AND** se muestra el nombre del archivo PDF en la cabecera del panel

### Requirement: Navegación automática a página
El visor SHALL navegar automáticamente a la página específica donde se encontró la evidencia.

#### Scenario: Navegación exacta
- **WHEN** la evidencia incluye un pageNumber o calculatedPage
- **THEN** el visor carga y muestra esa página específica
- **AND** el número de página se muestra en la cabecera del panel

#### Scenario: Página no disponible
- **WHEN** el número de página es null o 0
- **THEN** el visor carga la página 1 por defecto
- **AND** se muestra un aviso "Página no especificada" en la cabecera

### Requirement: Resaltado de texto en PDF
El sistema SHALL resaltar el fragmento de texto (rawTextSnippet) en la página actual del PDF.

#### Scenario: Resaltado exitoso
- **WHEN** el visor carga una página y hay un rawTextSnippet disponible
- **THEN** el texto coincidente se resalta con fondo amarillo fluorescente
- **AND** el resaltado es visible al usuario sin requerir interacción adicional

#### Scenario: Texto no encontrado
- **WHEN** el rawTextSnippet no se encuentra en la página especificada
- **THEN** el visor muestra la página sin resaltado
- **AND** se registra un warning en consola para debugging

### Requirement: Modos responsivos del visor
El visor SHALL adaptar su comportamiento según el tamaño de pantalla.

#### Scenario: Modo drawer en desktop (>1024px)
- **WHEN** el viewport es mayor a 1024px
- **THEN** el visor se muestra como panel lateral deslizable (drawer)
- **AND** ocupa el 40% del ancho de pantalla
- **AND** la matriz permanece visible al lado izquierdo

#### Scenario: Modo modal en tablet (768-1024px)
- **WHEN** el viewport está entre 768px y 1024px
- **THEN** el visor se muestra como modal centrado
- **AND** ocupa el 80% del ancho y 90% del alto
- **AND** el fondo se oscurece

#### Scenario: Modo fullscreen en mobile (<768px)
- **WHEN** el viewport es menor a 768px
- **THEN** el visor se muestra en pantalla completa
- **AND** incluye controles de navegación por swipe
- **AND** un botón flotante permite cerrar el visor

### Requirement: Controles de navegación
El visor SHALL proporcionar controles básicos de navegación dentro del PDF.

#### Scenario: Cambio de página
- **WHEN** el visor está abierto
- **THEN** se muestran botones "Anterior" y "Siguiente" para navegar páginas
- **AND** se muestra "Página X de Y" en la cabecera

#### Scenario: Zoom básico
- **WHEN** el usuario hace clic en los botones de zoom (+/-)
- **THEN** el PDF se escala proporcionalmente
- **AND** el zoom por defecto es 1.5x para legibilidad

## Dependencies
- pdfjs-dist (ya instalado)
- Componente UnifiedCoverageMatrix (disparadores)
