# Apply Progress: mejora-coherencia-ux-negocio

## Change Overview
Corrección de dos requisitos que estaban marcados como completos en `tasks.md` pero que aún no estaban realmente implementados en el código.

## What Was Implemented

### 3.1 Domain selector moved to the main configuration bar
- `DomainSelector` ya no se renderiza dentro de `FileUploader` por defecto.
- Se agregó `DomainSelector` en la barra superior de configuración de `App.tsx`, al lado de `ClientSelector`.
- Se mantuvo el estado `domain`/`setDomain` en `App.tsx` y se restringieron las opciones visibles a `['pyme', 'autos']` mediante una nueva prop `allowedDomains` en `DomainSelector`.
- Al cambiar de cliente, `domain` se resetea a `'pyme'` (además del reset existente en `handleReset`).

### 3.3 Interactive client-selection feedback in `FileUploader`
- Se reemplazó el banner estático de advertencia por un `<button>` interactivo.
- Se agregó la prop opcional `onFocusClientSelection?: () => void` a `FileUploader`.
- `App.tsx` provee un callback que abre el `ClientSelector` (`setClientSelectorOpen(true)`).
- `ClientSelector` ahora soporta estado controlado mediante las props `isOpen` y `onOpenChange`, permitiendo que `App.tsx` abra el dropdown de selección/creación de cliente desde el banner.

## Files Changed

- `App.tsx`
  - Importa `DomainSelector` y `InsuranceDomain`.
  - Agrega estado `clientSelectorOpen`.
  - Coloca `DomainSelector` junto a `ClientSelector` en la barra de configuración.
  - Pasa `isOpen`/`onOpenChange` a `ClientSelector`.
  - Resetea `domain` a `'pyme'` al seleccionar un cliente.
  - Quita `domain`/`onDomainChange` del `FileUploader` principal y pasa `onFocusClientSelection`.

- `components/DomainSelector.tsx`
  - Agrega prop opcional `allowedDomains?: InsuranceDomain[]` para filtrar las opciones mostradas.

- `components/ClientSelector.tsx`
  - Agrega props opcionales `isOpen` y `onOpenChange`.
  - Implementa patrón controlado/no controlado para el estado de apertura del dropdown.

- `components/FileUploader.tsx`
  - Cambia el valor por defecto de `showDomainSelector` a `false`.
  - Agrega prop `onFocusClientSelection`.
  - Reemplaza el banner estático por un botón interactivo que invoca `onFocusClientSelection`.

- `openspec/changes/mejora-coherencia-ux-negocio/tasks.md`
  - Se actualizaron las casillas de verificación para reflejar el estado real: todas las tareas ahora están `[x]`.

- `openspec/changes/mejora-coherencia-ux-negocio/apply-progress.md`
  - Este archivo.

## Verification Results

| Command | Outcome |
|---|---|
| `npm run test:unit:frontend` | ✅ 13 files, 86 tests passed |
| `npm run typecheck:frontend` | ⚠️ Pre-existing errors in backend/test files and DomainSelector icon types; no new errors introduced by changes in `App.tsx`, `FileUploader.tsx`, or `ClientSelector.tsx` |
| `npm run lint` | ⚠️ 1 pre-existing error (`server/src/services/matrixTransformer.ts:206` `no-require-imports`) and several pre-existing warnings; no new errors in changed files |
| `npm run format:check` | ⚠️ 28 files with pre-existing formatting issues; the 4 files modified for this change were formatted with Prettier and now pass `--check` |

## Remaining Work / Risks

- **Pre-existing type errors:** `typecheck:frontend` reports many errors unrelated to this change (backend tests, icon type mismatch in `DomainSelector`, etc.). These should be addressed in a separate cleanup change.
- **Pre-existing lint error:** `server/src/services/matrixTransformer.ts` uses `require()` and fails `npm run lint`. Unrelated to this change.
- **Next step:** Run `openspec-verify-change` (or equivalent manual verification) and then archive the change.

## Recommended Next Action

`verify` → `archive`
