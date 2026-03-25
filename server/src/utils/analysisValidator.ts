// Lista de coberturas de la Plantilla PYME
export const PLANTILLA_ITEMS = [
  "Incendio (Edificio y Contenidos)",
  "Lucro Cesante",
  "Sustracción / Hurto",
  "Equipo Eléctrico y Electrónico",
  "Rotura de Maquinaria",
  "Responsabilidad Civil (RCE)",
  "Vidrios Planos",
  "Manejo Global / Infidelidad",
  "Transporte de Mercancías",
  "Transporte de Valores",
  "Asistencia PYME",
  "Asistencia Legal",
  "Huelga, Motín, Asonada (HMACC)",
  "Terremoto y Eventos Catastróficos"
];

// Normalizar texto para comparación
const normalizeText = (text: string) => {
  if (!text) return "";
  return text.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "") // Mantener espacios para mejor matching
    .trim();
};

// Mapeo de variantes comunes a nombres estándar - EXPANDIDO
const COVERAGE_VARIANTS: Record<string, string[]> = {
  "Incendio (Edificio y Contenidos)": [
    "incendio", "fuego", "combustion", "explosion", "rayo", "edificio", "contenido",
    "incendio edificio", "incendio contenidos", "danos por fuego", "danos materiales",
    "fire", "building", "contents", "incendio locativo", "incendio inmobiliario"
  ],
  "Lucro Cesante": [
    "lucro cesante", "perdida beneficios", "interrupcion negocio", "business interruption",
    "perdida de utilidades", "renta", "pérdida de beneficios", "lucro", "cesante",
    "interrupcion", "bi", "consequential loss"
  ],
  "Sustracción / Hurto": [
    "sustraccion", "hurto", "robo", "asalto", "atraco", "robo con violencia",
    "hurto simple", "hurto calificado", "amit", "all risk", "theft", "burglary",
    "robbery", "sustraccion con violencia", "dineros con violencia"
  ],
  "Equipo Eléctrico y Electrónico": [
    "equipo electrico", "equipo electronico", "computadores", "servidores",
    "equipos de computo", "hardware", "perifericos", "equipos electronicos",
    "electronic equipment", "eee", "datos", "equipos", "maquinaria electronica"
  ],
  "Rotura de Maquinaria": [
    "rotura maquinaria", "averia maquinaria", "danos maquinas", "falla mecanica",
    "breakdown", "rotura", "averia", "machinery breakdown", "equipo mecanico",
    "caldera", "equipo de presion", "explosion caldera"
  ],
  "Responsabilidad Civil (RCE)": [
    "responsabilidad civil", "daños terceros", "rc", "rce", "civil liability",
    "responsabilidad extracontractual", "daños a terceros", "terceros",
    "civil", "liability", "rc patronal", "responsabilidad laboral"
  ],
  "Vidrios Planos": [
    "vidrios planos", "cristales", "vidrios", "escaparates", "vitrinas",
    "rotura vidrios", "danos cristales", "plateglass", "glass", "fachada"
  ],
  "Manejo Global / Infidelidad": [
    "manejo global", "infidelidad", "fidelidad", "dishonesty", "fidelity",
    "desfalco", "malversacion", "fraude interno", "conducta desleal",
    "faithful performance", "fianza", "caucion", "global"
  ],
  "Transporte de Mercancías": [
    "transporte mercancias", "transporte bienes", "carga", "goods in transit",
    "mercancias en transito", "transporte de carga", "transito", "cargo",
    "transporte", "mercancia"
  ],
  "Transporte de Valores": [
    "transporte valores", "valores", "dinero en transito", "cash in transit",
    "fondos en movimiento", "transporte dinero", "cash", "dinero"
  ],
  "Asistencia PYME": [
    "asistencia pyme", "asistencia", "asistencia medica", "asistencia hogar",
    "servicios de asistencia", "emergencias", "home assistance", "medical",
    "servicios", "apoyo"
  ],
  "Asistencia Legal": [
    "asistencia legal", "defensa legal", "servicios juridicos", "abogado",
    "consultoria legal", "legal assistance", "legal", "defensa judicial"
  ],
  "Huelga, Motín, Asonada (HMACC)": [
    "huelga", "motin", "asonada", "hmacc", "conmocion civil",
    "disturbios", "vandalismo", "daños por tumulto", "riot", "strike",
    "civil commotion", "malicious damage"
  ],
  "Terremoto y Eventos Catastróficos": [
    "terremoto", "temblor", "sismo", "catastrofe natural", "desastre natural",
    "evento catastrofico", "maremoto", "tsunami", "earthquake", "quake",
    "catastrofe", "fenomeno natural", "desastre"
  ]
};

// Logging de debug
const DEBUG = process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV === 'development';

// Validar y completar coberturas
export const validateAndCompleteCoverages = (coverages: any[], insurerName?: string): any[] => {
  const result: any[] = [];
  const usedOriginalIndices = new Set<number>();
  
  if (DEBUG) {
    console.log(`\n🔍 Validando coberturas para: ${insurerName || 'Aseguradora'}`);
    console.log(`   Coberturas recibidas: ${coverages.length}`);
    coverages.forEach((c, i) => console.log(`   ${i + 1}. "${c.name}" = "${c.value}"`));
  }
  
  for (const standardName of PLANTILLA_ITEMS) {
    // Buscar coincidencia exacta primero
    let matched = coverages.find((c, idx) => {
      if (usedOriginalIndices.has(idx)) return false;
      const normalizedInput = normalizeText(c.name);
      const normalizedStandard = normalizeText(standardName);
      return normalizedInput === normalizedStandard;
    });
    
    // Si no hay coincidencia exacta, buscar por variantes
    if (!matched) {
      const variants = COVERAGE_VARIANTS[standardName] || [];
      matched = coverages.find((c, idx) => {
        if (usedOriginalIndices.has(idx)) return false;
        const normalizedInput = normalizeText(c.name);
        return variants.some(v => {
          const normalizedVariant = normalizeText(v);
          return normalizedInput.includes(normalizedVariant) || normalizedVariant.includes(normalizedInput);
        });
      });
    }
    
    if (matched) {
      // Encontrar el índice original para marcarlo como usado
      const originalIdx = coverages.indexOf(matched);
      usedOriginalIndices.add(originalIdx);
      
      // Si el valor es "EXCLUIDO" pero hay descripción positiva, revisar
      let value = matched.value || "NO ESPECIFICADO";
      
      // Evitar marcar como EXCLUIDO si hay un valor numérico o descripción larga
      if (value.toUpperCase() === "EXCLUIDO" || value.toUpperCase() === "NO APLICA") {
        const hasValue = /\$|\d+|incluido|cobertura|asegurado/i.test(matched.value);
        if (hasValue && matched.value.length > 15) {
          value = matched.value; // Usar el valor original si parece válido
        }
      }
      
      result.push({
        name: standardName,
        value: value,
        deductible: matched.deductible || ""
      });
      
      if (DEBUG) {
        console.log(`   ✅ ${standardName}: "${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"`);
      }
    } else {
      // No se encontró, agregar como NO ESPECIFICADO
      result.push({
        name: standardName,
        value: "NO ESPECIFICADO",
        deductible: ""
      });
      
      if (DEBUG) {
        console.log(`   ⚠️  ${standardName}: NO ESPECIFICADO (no match)`);
      }
    }
  }
  
  // Coberturas no mapeadas (extras)
  const unmapped = coverages.filter((c, idx) => !usedOriginalIndices.has(idx));
  if (unmapped.length > 0 && DEBUG) {
    console.log(`\n   📎 Coberturas adicionales no mapeadas:`);
    unmapped.forEach(c => console.log(`      - "${c.name}" = "${c.value}"`));
  }
  
  return result;
};

// Parsear deducibles estructurados
export const parseDeductibles = (deductiblesText: string): any[] => {
  const results: any[] = [];
  const lines = deductiblesText.split('\n').filter(l => l.trim());
  
  for (const line of lines) {
    // Buscar patrones como:
    // "Incendio: 10% / Mín. 2 SMMLV"
    // "Terremoto: 20% sobre valor asegurado"
    // "Hurto: Sin deducible"
    
    const match = line.match(/^([^:]+):\s*(.+)$/i);
    if (match) {
      const coverage = match[1].trim();
      const details = match[2].trim();
      
      // Extraer porcentaje
      const percentMatch = details.match(/(\d+(?:\.\d+)?)\s*%/);
      const percentage = percentMatch ? percentMatch[1] + '%' : '';
      
      // Extraer mínimo en SMMLV
      const smmlvMatch = details.match(/m[ií]n\.?\s*(\d+(?:\.\d+)?)\s*(?:smmlv|salarios?)/i);
      const minimum = smmlvMatch ? `Mín. ${smmlvMatch[1]} SMMLV` : '';
      
      // Determinar sobre qué aplica
      let appliesTo = '';
      if (details.toLowerCase().includes('valor asegurado') || details.toLowerCase().includes('suma asegurada')) {
        appliesTo = 'Sobre Valor Asegurado';
      } else if (details.toLowerCase().includes('perdida') || details.toLowerCase().includes('siniestro')) {
        appliesTo = 'Sobre Pérdida';
      }
      
      results.push({
        coverage,
        fullText: details,
        percentage,
        minimum,
        appliesTo,
        isGood: !details.toLowerCase().includes('valor asegurado') || details.toLowerCase().includes('perdida')
      });
    }
  }
  
  return results;
};

// Validar análisis completo
export const validateAnalysis = (analysis: any): any => {
  if (!analysis || !analysis.quotes) return analysis;
  
  for (const quote of analysis.quotes) {
    // Asegurar que coverages existe y es un array
    if (!quote.coverages || !Array.isArray(quote.coverages)) {
      quote.coverages = [];
    }
    
    // Validar y completar coberturas
    quote.coverages = validateAndCompleteCoverages(quote.coverages, quote.insurerName);
    
    // Parsear deducibles si es texto
    if (quote.deductibles && typeof quote.deductibles === 'string') {
      quote.deductiblesParsed = parseDeductibles(quote.deductibles);
    }
  }
  
  return analysis;
};
