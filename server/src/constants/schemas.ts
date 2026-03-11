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
                    deductibles: { type: "STRING", description: "Formato estandarizado: 'Concepto: % Valor / Mínimo'" },
                    coverages: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                name: { type: "STRING" },
                                value: { type: "STRING" },
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
                                description: { type: "STRING" }
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
                    score: { type: "NUMBER" },
                }
            }
        },
        deductibleComparison: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    insurer: { type: "STRING" },
                    deductibleText: { type: "STRING" }
                }
            }
        },
        recommendation: { type: "STRING" },
        marketAnalysis: { type: "STRING" }
    }
};
