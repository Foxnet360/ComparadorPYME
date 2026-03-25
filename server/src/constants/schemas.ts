export const ANALYSIS_SCHEMA = {
    type: "OBJECT",
    properties: {
        quotes: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    insurerName: { type: "STRING" },
                    policyName: { type: "STRING" },
                    priceMonthly: { type: "NUMBER" },
                    priceAnnual: { type: "NUMBER" },
                    currency: { type: "STRING" },
                    deductibles: { 
                        type: "STRING", 
                        description: "Formato estructurado por cobertura: 'COBERTURA: % / Mín. X SMMLV (aplica sobre pérdida|valor asegurado)' - Separar cada cobertura con salto de línea"
                    },
                    coverages: {
                        type: "ARRAY",
                        description: "DEBE incluir TODAS las 14 coberturas de la Plantilla PYME. Usar EXACTAMENTE los nombres especificados.",
                        items: {
                            type: "OBJECT",
                            properties: {
                                name: { 
                                    type: "STRING",
                                    description: "Usar EXACTAMENTE uno de: Incendio (Edificio y Contenidos), Lucro Cesante, Sustracción / Hurto, Equipo Eléctrico y Electrónico, Rotura de Maquinaria, Responsabilidad Civil (RCE), Vidrios Planos, Manejo Global / Infidelidad, Transporte de Mercancías, Transporte de Valores, Asistencia PYME, Asistencia Legal, Huelga, Motín, Asonada (HMACC), Terremoto y Eventos Catastróficos"
                                },
                                value: { 
                                    type: "STRING",
                                    description: "Monto asegurado o descripción. Ej: 100%, $500M, Incluido, NO ESPECIFICADO, EXCLUIDO"
                                },
                                deductible: {
                                    type: "STRING",
                                    description: "Deducible específico para esta cobertura en formato: '% / Mín. X SMMLV' o 'No aplica'"
                                }
                            }
                        }
                    },
                    alerts: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                level: { type: "STRING", enum: ['CRITICAL', 'WARNING', 'GOOD', 'INFO'] },
                                title: { type: "STRING" },
                                description: { type: "STRING" },
                                clauseReference: { 
                                    type: "STRING", 
                                    description: "Cita exacta del clausulado que fundamenta esta alerta (opcional pero recomendado)" 
                                },
                                sourceDocument: { 
                                    type: "STRING", 
                                    description: "Nombre del documento fuente (ej: 'Clausulado AXA PYME v2.1')" 
                                }
                            }
                        },
                    },
                    scoringBreakdown: {
                        type: "OBJECT",
                        properties: {
                            coverage: { type: "NUMBER", description: "1-10 Amplitud" },
                            deductibles: { type: "NUMBER", description: "1-10 Bondad deducibles" },
                            exclusions: { type: "NUMBER", description: "1-10 Menos exclusiones" },
                            priceRatio: { type: "NUMBER", description: "1-10 Costo beneficio" },
                            sublimits: { type: "NUMBER", description: "1-10 Menos sublímites" },
                            warranties: { type: "NUMBER", description: "1-10 Facilidad garantías" }
                        }
                    },
                    clientAnalysis: { type: "STRING" },
                    technicalAnalysis: { type: "STRING" },
                    score: { type: "NUMBER", description: "Score final de 0 a 100 (NO de 0 a 10). Calculado como: (coverage*0.25 + deductibles*0.20 + exclusions*0.20 + priceRatio*0.15 + sublimits*0.10 + warranties*0.10) * 10. Debe ser un NÚMERO ENTERO redondeado al entero más cercano (ej: 72, no 72.25)" },
                }
            }
        },
        deductibleComparison: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    insurer: { type: "STRING" },
                    coverageName: { type: "STRING" },
                    percentage: { type: "STRING" },
                    minimum: { type: "STRING" },
                    appliesTo: { type: "STRING" },
                    notes: { type: "STRING" }
                }
            }
        },
        recommendation: { type: "STRING" },
        marketAnalysis: { type: "STRING" }
    }
};
