# Spec: Módulo de Analítica Ejecutiva y Servicios DaaS

## Requirements

### Requirement 1: Enforzamiento Estricto de RBAC en Analítica
El sistema debe servir métricas analíticas calculadas en el servidor, adaptando la granularidad y los datos expuestos exclusivamente según el rol (`role`) y la organización (`org_id`) del token autenticado.
- `ally_technical`: Solo ve métricas asociadas a su `user_id`.
- `ally_admin`: Solo ve métricas agregadas de su `org_id` y de los miembros de su equipo.
- `super_admin`: Acceso al consolidado global de la plataforma y telemetría de activos DaaS.

### Requirement 2: Arquitectura de Datos para DaaS (Data as a Service)
El sistema debe mantener un repositorio anonimizado continuo (`daas_market_snapshots`) derivado de las cotizaciones y estudios comparativos procesados en la plataforma.
- Debe eliminar cualquier dato identificable de personas naturales o jurídicas (PII, nombres, NITs, placas, direcciones).
- Debe registrar variables actuariales: ramo, aseguradora, suma asegurada, prima neta, deducibles estructurados, resultado comercial (ganada/perdida) y ubicación geográfica macro (ciudad/departamento).
- Debe ofrecer benchmarks agregados (media, mediana, percentiles 25 y 75) por ramo y rango de suma asegurada.

### Requirement 3: Optimización de Performance Server-Side
El módulo de analítica no debe descargar historiales completos en el cliente ni realizar iteraciones de filtrado en JavaScript. Las métricas deben agregarse directamente en PostgreSQL mediante consultas indexadas o vistas analíticas, garantizando tiempos de respuesta inferiores a 300ms.
