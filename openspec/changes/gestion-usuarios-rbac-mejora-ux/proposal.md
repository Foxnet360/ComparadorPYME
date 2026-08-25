# Proposal: CRUD RBAC de Usuarios y Aliados, Monitor de Tokens IA y UX Dinámica de Clientes y Clausulados

## Intent
Implementar la gestión completa CRUD de usuarios por nivel jerárquico (`super_admin` y `ally_admin`), el panel de control de consumo de tokens y costos de IA para el Super Admin, el enriquecimiento dinámico de perfiles de cliente según el ramo seleccionado, y la optimización integral de la biblioteca de clausulados.

## Scope

### 1. CRUD Jerárquico de Usuarios y Aliados (`UserManagement.tsx`)
- **Administrador de Aliado (`ally_admin`):** Administrar analistas técnicos de su misma correduría (`ally_id`).
- **Super Administrador (`super_admin`):** Administrar la lista completa de Aliados (Corredurías) y todos los usuarios del sistema, pudiendo cambiar roles y asignaciones.
- **Perfil de Usuario (`ProfileScreen.tsx`):** Indicador visual destacado del rol activo (`Super Admin`, `Admin Aliado`, `Analista Técnico`) y nombre de la correduría.

### 2. Monitor de Consumo de Tokens & Costos IA para Super Admin
- Dashboard integrado en Analítica Ejecutiva para rastrear consumo de tokens Gemini 3.5 (Input/Output).
- Cálculo de costo estimado por comparación (USD/COP) y consumo acumulado por Aliado y Ramo.

### 3. Perfil Dinámico de Cliente por Ramo (`ClientManager.tsx` / `ClientSelector.tsx`)
- Formulario adaptativo con campos específicos por naturaleza de ramo:
  - *PYME / Comercial:* Activos fijos, empleados, nivel de riesgo comercial.
  - *Copropiedades:* Torres, unidades, plantas, ascensores, zona sísmica NSR-10.
  - *Daños Materiales:* Sistemas contra incendio, tipo de construcción.
  - *Transportes:* Tipo de carga, valor por despacho, rutas frecuentes.
  - *Equipo Electrónico & Maquinaria:* Mantenimiento preventivo, antigüedad de equipos.
- Inyección de estos metadatos en el contexto de análisis del motor de IA.

### 4. Rediseño de Usabilidad de Biblioteca de Clausulados (`ClauseAdmin.tsx`)
- Búsqueda en tiempo real, filtro multidominio (8 ramos) y vista previa modal de texto de clausulados.
- Badge visual de indexación vectorial (Supabase PGVector 3072d).
- Carga masiva simplificada y gestión de versiones activas.

## Success Criteria
- CRUD jerárquico funcional con restricciones RLS por rol y aliado.
- Monitor de consumo de tokens e importe estimado en vista Super Admin.
- Campos específicos por ramo en la creación/edición de clientes que enriquecen el informe.
- Biblioteca de clausulados fluida con vista previa y filtrado instantáneo por ramo.
