# Tasks: Acceso Rápido de Roles, Selector de Ramos y Campos de Cliente Filtrados

## Phase 1: Cuentas y Botones de Prueba Rápida por Rol
- [ ] 1.1 Definir las 3 cuentas de prueba de roles en `services/storageService.ts` / `LoginScreen.tsx`.
- [ ] 1.2 Agregar panel de botones 1-clic ("Probar Super Admin", "Probar Admin Aliado", "Probar Técnico Analista") en `LoginScreen.tsx`.

## Phase 2: Rediseño Visual de Selector de Ramos
- [ ] 2.1 Rediseñar `DomainSelector.tsx` como un grid prominente agrupado en 3 categorías (*Patrimoniales*, *Responsabilidad Civil*, *Transporte & Especiales*).
- [ ] 2.2 Integrar el nuevo `DomainSelector` en el encabezado principal de `App.tsx` para la vista "Nueva Comparación".

## Phase 3: Campos de Cliente Relevantes por Ramo
- [ ] 3.1 Actualizar el modal de creación de cliente en `ClientSelector.tsx` con renderizado condicional según `activeDomain`.
- [ ] 3.2 Ocultar campos de copropiedades cuando el ramo no sea copropiedades y mostrar únicamente los campos pertinentes del ramo.

## Phase 4: Verificación & Despliegue
- [ ] 4.1 Ejecutar pruebas unitarias con `npm test`.
- [ ] 4.2 Confirmar compilación limpia con `npm run build` y desplegar a Railway.
