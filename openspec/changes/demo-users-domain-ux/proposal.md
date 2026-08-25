# Proposal: Botones de Prueba Rápida de Roles, Rediseño de Selector de Ramos y Campos de Cliente Filtrados por Ramo

## Intent
Facilitar la prueba inmediata de los 3 roles RBAC (`Super Admin`, `Admin Aliado`, `Analista Técnico`) mediante botones de inicio de sesión rápido, rediseñar el selector de los 8 Ramos de Seguro con alta visibilidad y agrupación por categoría en la pantalla de "Nueva Comparación", y adaptar dinámicamente el formulario de clientes para solicitar **únicamente** los campos pertinentes al ramo a analizar.

## Scope

### 1. Botones de Prueba Rápida de Roles (`LoginScreen.tsx` & `App.tsx`)
- Incorporar barra de credenciales de demostración / login en 1-clic para los 3 roles:
  - 👑 **Super Admin:** `superadmin@comparadorcsa.com` (Visión Global Multi-Aliado)
  - 👔 **Admin Aliado:** `director@andina.com` (Director de Correduría Andina)
  - 👷 **Analista Técnico:** `carlos.mendoza@andina.com` (Técnico Analista Senior)

### 2. Rediseño del Selector de Ramos (`DomainSelector.tsx` / `App.tsx`)
- Ubicar el selector de ramos con alta prominencia visual en el encabezado del flujo "Nueva Comparación".
- Organizar los **8 Ramos** en 3 categorías claras con íconos e insignias:
  - **Patrimoniales:** *PYME Multirriesgo*, *Todo Riesgo Daños Materiales*, *Sustracción*, *Equipo Electrónico*, *Rotura de Maquinaria*.
  - **Responsabilidad Civil:** *Responsabilidad Civil General (RCE)*.
  - **Transporte y Especiales:** *Transporte de Mercancías*, *Manejo / Infidelidad*.

### 3. Formularios Adaptativos de Cliente por Ramo (`ClientSelector.tsx` / `ClientManager.tsx`)
- Ocultar campos irrelevantes (ej: torres, ascensores o zonas NSR-10 de copropiedades cuando se analiza *Transporte* o *Equipo Electrónico*).
- Renderizar dinámicamente **únicamente los campos relevantes al ramo seleccionado**:
  - *PYME / Daños:* Activos fijos, empleados, sistemas contra incendio.
  - *Copropiedades:* Torres, unidades, ascensores, zona sísmica NSR-10.
  - *Transporte de Mercancías:* Tipo de carga, despacho máximo por viaje, rutas.
  - *Equipo Electrónico / Rotura:* Valor de reposición de maquinaria, programa de mantenimiento.

## Success Criteria
- Acceso en 1-clic a cualquiera de las 3 cuentas de prueba de roles.
- Selector de los 8 ramos agrupado y destacado en la vista de "Nueva Comparación".
- Formulario de cliente adaptativo que solicita solo información útil para el ramo en evaluación.
