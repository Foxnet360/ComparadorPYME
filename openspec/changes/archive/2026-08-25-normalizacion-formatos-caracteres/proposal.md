# Proposal: Normalización Inteligente de Formatos Numéricos, Moneda, Fechas, Porcentajes y Sanitización UTF-8 de Caracteres Especiales

## Intent
Corregir los errores de interpretación en valores de cotizaciones causados por ambigüedades en separadores de miles y decimales (formato es-CO `$ 15.000.000,00` vs formato US/Internacional `$ 15,000,000.00`), estandarizar el parseo de porcentajes y fechas, y solucionar la corrupción de caracteres especiales (Mojibake UTF-8 como `Ã©`, `Ã±`, `Ã¡`) en la interfaz de producción.

## Scope

### 1. Robustecimiento del Parseo de Moneda y Números (`server/src/utils/currencyParser.ts` & `formatCurrency.ts`)
- Detectar dinámicamente si el separador de miles es punto o coma evaluando la estructura completa del número:
  - Formato es-CO / LatAm: `$15.000.000,00` o `15.000.000` (Punto = Miles, Coma = Decimal).
  - Formato US / Internacional: `$15,000,000.00` o `15,000.50` (Coma = Miles, Punto = Decimal).
- Evitar que `$15,000,000.00` se convierta erróneamente a `$15.00`.
- Manejar expresiones como `$15 Millones`, `$ 15M`, `15'000.000`.

### 2. Normalizador de Porcentajes y Fechas (`server/src/utils/numberNormalizer.ts`)
- **Porcentajes:** Convertir valores como `"10%"`, `"10,5 %"`, `"10.5%"`, `"0.10"` a número flotante estandarizado `10.5`.
- **Fechas:** Estandarizar expresiones como `"25/08/2026"`, `"2026-08-25"`, `"25 de agosto de 2026"` a ISO string `2026-08-25`.

### 3. Sanitizador de Caracteres Especiales / Decodificador Mojibake (`server/src/utils/textSanitizer.ts` & `utils/stringUtils.ts`)
- Reemplazar secuencias Mojibake resultantes de doble decodificación UTF-8 / ISO-8859-1 en PDF e inspección RAG:
  - `Ã¡` → `á`, `Ã©` → `é`, `Ã\u00ad` / `Ã­` → `í`, `Ã³` → `ó`, `Ãº` → `ú`, `Ã±` → `ñ`, `Ã‘` → `Ñ`, `Â°` → `°`.
- Aplicar la sanitización en el controlador de respuestas de análisis y matriz unificada.

## Success Criteria
- `$15,000,000.00` y `$15.000.000,00` se convierten correctamente a `15000000.0`.
- Se eliminan las respuestas falsas causadas por truncamiento de decimales.
- Textos con tildes y ñ se visualizan nítidos en la interfaz web de producción sin caracteres corruptos.
- Pruebas unitarias de parseo numérico y sanitización pasando al 100%.
