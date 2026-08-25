# Design: Botones de Prueba Rápida de Roles, Rediseño de Selector de Ramos y Campos de Cliente Filtrados por Ramo

## Component Architecture

### 1. Quick Role Access Bar (`components/LoginScreen.tsx`)
- Añadir sección "Acceso Rápido para Pruebas (Roles RBAC)" en el `LoginScreen` con 3 botones:
  - `[ 👑 Probar Super Admin ]`
  - `[ 👔 Probar Admin Aliado ]`
  - `[ 👷 Probar Analista Técnico ]`
- Cada botón autocompleta e inicia sesión inmediatamente con el perfil correspondiente.

### 2. Prominencia Visual de Ramos (`components/DomainSelector.tsx` & `App.tsx`)
- Transformar `DomainSelector` en un Grid/Pill Bar destacado en el tope de la pantalla "Nueva Comparación".
- Cada ramo se muestra con tarjeta distintiva, color por categoría, ícono e indicador de selección.

### 3. Formulario Dinámico de Registro de Cliente (`components/ClientSelector.tsx`)
- Filtrar la visibilidad de los campos según `activeDomain`:
  - `domain === 'copropiedades'`: Muestra torres, unidades, pisos, ascensores, planta eléctrica, zona NSR-10.
  - `domain === 'pyme'`: Muestra valor de activos fijos, empleados, sector económico.
  - `domain === 'danos_materiales'`: Muestra sistema contra incendio, tipo de construcción, vigilancia 24/7.
  - `domain === 'transporte'`: Muestra tipo de carga, valor por despacho, rutas.
  - `domain === 'equipo_electronico' | 'rotura_maquinaria'`: Muestra valor de reposición de equipos, mantenimiento preventivo.
  - Otros ramos: Solamente información general del cliente (Razón social, NIT, email, teléfono, ciudad).
