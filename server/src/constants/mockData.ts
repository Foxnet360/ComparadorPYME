export const MOCK_ANALYSIS_RESULT = {
    quotes: [
        {
            insurerName: "Seguros Demo S.A.",
            policyName: "Póliza Todo Riesgo Daños Materiales",
            priceMonthly: 154000,
            priceAnnual: 1848000,
            currency: "COP",
            deductibles: "Terremoto: 2% Valor Asegurable / Mínimo 5 SMMLV",
            coverages: [
                { name: "Incendio y Rayo", value: "Valor Total Asegurado" },
                { name: "Sustracción", value: "100% Limitado al 50% VA" },
                { name: "Equipo Electrónico", value: "20.000.000" },
                { name: "Responsabilidad Civil Extracontractual", value: "500.000.000" }
            ],
            alerts: [
                { level: "WARNING", title: "Deducible Alto en Terremoto", description: "El deducible de terremoto es superior al estándar del mercado (2% vs 1%)." },
                { level: "GOOD", title: "Cobertura RC Amplia", description: "Incluye RC Cruzada y Patronal con límites altos." }
            ],
            scoringBreakdown: {
                coverage: 8,
                deductibles: 6,
                exclusions: 7,
                priceRatio: 7,
                sublimits: 8,
                warranties: 9
            },
            clientAnalysis: "Esta opción ofrece una protección robusta en Responsabilidad Civil, ideal para su operación con alto tráfico de terceros. Sin embargo, el deducible de terremoto podría representar un riesgo financiero mayor en caso de siniestro.",
            technicalAnalysis: "El clausulado es estándar (Fasecolda 2024). Destaca la inclusión automática de la cláusula de 72 horas para eventos de la naturaleza. Excluye explícitamente lucro cesante por huelga.",
            score: 7.8
        },
        {
            insurerName: "Aseguradora Ejemplo Global",
            policyName: "Pyme Protegida",
            priceMonthly: 0,
            priceAnnual: 2100000,
            currency: "COP",
            deductibles: "Terremoto: 1% Valor Asegurable / Mínimo 3 SMMLV",
            coverages: [
                { name: "Incendio y Rayo", value: "Valor Total Asegurado" },
                { name: "Sustracción", value: "100% Limitado al 80% VA" },
                { name: "Equipo Electrónico", value: "30.000.000" },
                { name: "Responsabilidad Civil Extracontractual", value: "200.000.000" }
            ],
            alerts: [
                { level: "GOOD", title: "Mejor Deducible Terremoto", description: "Deducible competitivo del 1%." },
                { level: "CRITICAL", title: "Sublímite RC Bajo", description: "La cobertura de RC es baja comparada con la exposición del riesgo." }
            ],
            scoringBreakdown: {
                coverage: 7,
                deductibles: 9,
                exclusions: 8,
                priceRatio: 6,
                sublimits: 9,
                warranties: 8
            },
            clientAnalysis: "Opción más costosa pero con mejores condiciones en deducibles de eventos catastróficos. Recomendada si la prioridad es reducir la retención de riesgos en caso de terremoto.",
            technicalAnalysis: "Condiciones generales favorables en sustracción. Garantías de seguridad física exigibles (alarmas monitoreadas) obligatorias para cobertura de robo.",
            score: 8.2
        }
    ],
    deductibleComparison: [
        { insurer: "Seguros Demo S.A.", deductibleText: "Terremoto: 2% VA, Huelga: 10% Pérdida" },
        { insurer: "Aseguradora Ejemplo Global", deductibleText: "Terremoto: 1% VA, Huelga: 5% Pérdida" }
    ],
    recommendation: "Recomendamos **Aseguradora Ejemplo Global** si el presupuesto lo permite, debido a su estructura de deducibles más favorable que protege mejor el flujo de caja en eventos mayores. Si se busca economía, **Seguros Demo S.A.** es viable pero requiere asumir mayor riesgo propio.",
    marketAnalysis: "El mercado actual muestra una tendencia al endurecimiento en tasas de terremoto. La oferta de Ejemplo Global va en contra de la tendencia con un deducible agresivo, lo cual es una oportunidad."
};
