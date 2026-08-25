# Design: Normalización de Formatos Numéricos, Monedas, Fechas, Porcentajes y Sanitización UTF-8

## Component & Utility Architecture

### 1. Advanced Currency & Number Parser (`server/src/utils/currencyParser.ts`)
- **Algoritmo de Detección de Notación:**
  1. Si la cadena contiene **ambos** separadores (`.` y `,`):
     - Si la última posición de la coma es posterior al último punto (ej: `15.000,50`), es notación LatAm/es-CO.
       - Remover puntos (miles) -> reemplazar coma por punto (decimal).
     - Si la última posición del punto es posterior a la última coma (ej: `15,000,000.50`), es notación US/Internacional.
       - Remover comas (miles) -> mantener punto (decimal).
  2. Si contiene **solo comas**:
     - Si hay múltiples comas (ej: `15,000,000`), son separadores de miles -> remover comas.
     - Si hay 1 sola coma con 1 o 2 dígitos al final (ej: `15000,50` o `15000,5`), es decimal LatAm -> reemplazar por punto.
  3. Si contiene **solo puntos**:
     - Si hay múltiples puntos (ej: `15.000.000`), son separadores de miles -> remover puntos.
     - Si hay 1 solo punto seguido de exactamente 3 dígitos al final (ej: `15.000`), es separador de miles -> remover punto.
     - Si hay 1 solo punto seguido de 1 o 2 dígitos al final (ej: `15000.50`), es decimal US -> mantener punto.

### 2. Percentage & Date Normalizers (`server/src/utils/numberNormalizer.ts`)
- `parsePercentage(val: string): number | null`: Extrae números y convierte `"10.5%"` o `"10,5 %"` a `10.5`.
- `parseDateString(val: string): string | null`: Convierte cualquier formato de fecha a ISO YYYY-MM-DD.

### 3. Mojibake & UTF-8 Text Sanitizer (`server/src/utils/textSanitizer.ts`)
- Mapeo de secuencias de bytes mal decodificados (ISO-8859-1 en UTF-8):
  ```ts
  const MOJIBAKE_MAP: Record<string, string> = {
    'Ã¡': 'á', 'Ã©': 'é', 'Ã\u00ad': 'í', 'Ã\u00ad': 'í', 'Ã³': 'ó', 'Ãº': 'ú',
    'Ã±': 'ñ', 'Ã‘': 'Ñ', 'Ã\u0081': 'Á', 'Ã\u0089': 'É', 'Ã\u008d': 'Í', 'Ã\u0093': 'Ó',
    'Ã\u009a': 'Ú', 'Â°': '°', 'â€“': '–', 'â€”': '—', 'â€œ': '“', 'â€': '”'
  };
  ```
- Aplicar `sanitizeText(str)` recursivamente a todos los objetos de la respuesta de análisis antes de enviar la respuesta JSON al frontend.
