# Guía de Contribución y Estándares

## 1. Estándares de Código

### TypeScript
*   **Tipado Estricto:** No usar `any`. Definir interfaces para todas las estructuras de datos en `types.ts`.
*   **Interfaces vs Types:** Preferir `interface` para definiciones de objetos extensibles y `type` para uniones o alias simples.

### React
*   **Hooks:** Usar Hooks personalizados si la lógica de negocio crece dentro de un componente.
*   **Componentes:** Mantener los componentes pequeños (Principio de Responsabilidad Única).
    *   *Ejemplo:* `ComparisonReport` es un componente grande, idealmente debería refactorizarse en `RadarChartSection`, `CoverageTable`, etc.

### CSS (Tailwind)
*   Utilizar clases utilitarias directamente.
*   Para componentes complejos repetidos, extraer componentes React en lugar de usar `@apply`.
*   Mantener la paleta de colores consistente (Indigo/Slate).

## 2. Flujo de Trabajo (Git)

1.  Crear rama `feature/nombre-funcionalidad`.
2.  Desarrollar y probar localmente.
3.  Asegurar que no hay errores de linting.
4.  Commit con mensajes semánticos (ej: `feat: add progress bar`, `fix: calculation error`).

## 3. Pruebas (Futuro)
*   Actualmente el proyecto no tiene tests automatizados.
*   Se recomienda implementar **Vitest** para lógica de servicios (`geminiService`, `storageService`).
*   Implementar **React Testing Library** para componentes críticos (`ComparisonReport`).

## 4. Gestión de Errores
*   Todo servicio asíncrono debe tener bloques `try/catch`.
*   Los errores de la API de IA deben manejarse mostrando mensajes amigables al usuario (usar el estado `AppStatus.ERROR`).
