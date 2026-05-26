/**
 * Audit Enrichment Service
 * Enriches audit alerts with RAG evidence from clause documents
 */

import { ragRetrievalService, RetrievedClause } from './ragRetrievalService';
import { supabase } from '../config/database';
import { ClientProfile } from './contextualRiskAnalyzer';

export interface Evidence {
    id: string;
    documentId: string;
    insurerName: string;
    sectionType: string;
    content: string;
    pageNumber: number;
    similarityScore: number;
}

export interface EnrichedAlert {
    title: string;
    description: string;
    level: 'CRITICAL' | 'WARNING' | 'GOOD';
    insurerName: string;
    evidence: Evidence[];
    analysisType: 'rag_enriched' | 'quote_based';
    businessContext?: string;
}

export interface AuditEnrichmentResult {
    enrichedAlerts: EnrichedAlert[];
    hasClauses: boolean;
    crossInsurerRisks: CrossInsurerRisk[];
    businessContextAnalysis: string;
    progress?: {
        current: number;
        total: number;
        percentage: number;
    };
}

export type ProgressCallback = (current: number, total: number) => void;

export interface CrossInsurerRisk {
    riskTitle: string;
    riskDescription: string;
    affectedInsurers: string[];
    severity: 'CRITICAL' | 'WARNING' | 'GOOD';
}

/**
 * Check if clause documents exist for given insurers
 * Checks chunks first (actual table populated by indexing service), then clause_chunks, then documents table
 */
export const checkClausesAvailability = async (insurerNames: string[]): Promise<boolean> => {
    try {
        // First try chunks table directly without join to avoid PostgREST cache bugs
        const { data: chunkData, error: chunkError } = await supabase
            .from('chunks')
            .select('id')
            .limit(1);
        
        if (!chunkError && chunkData && chunkData.length > 0) {
            return true;
        }
        
        // Fallback: try clause_chunks (if it exists and has data)
        const { data: clauseData, error: clauseError } = await supabase
            .from('clause_chunks')
            .select('id')
            .in('insurer_name', insurerNames)
            .limit(1);
        
        if (!clauseError && clauseData && clauseData.length > 0) {
            return true;
        }
        
        // Final fallback: check documents table for clause documents
        const { data: docData, error: docError } = await supabase
            .from('documents')
            .select('id')
            .in('document_type', ['CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR'])
            .eq('is_active', true)
            .limit(1);
        
        if (docError) {
            console.error('❌ [auditEnrichment] Error checking clauses:', docError);
            return false;
        }
        
        return docData && docData.length > 0;
    } catch (error) {
        console.error('❌ [auditEnrichment] Exception checking clauses:', error);
        return false;
    }
};

/**
 * Extract key terms from alert for RAG search
 */
const extractSearchTerms = (alert: any): string => {
    const terms: string[] = [];
    
    if (alert.title) terms.push(alert.title);
    if (alert.description) terms.push(alert.description);
    
    // Extract coverage-related keywords
    const text = `${alert.title} ${alert.description}`.toLowerCase();
    
    // Common deductible keywords
    if (text.includes('deducible')) terms.push('deducible deducibles');
    if (text.includes('terremoto')) terms.push('terremoto sismo');
    if (text.includes('inundacion') || text.includes('inundación')) terms.push('inundación aluvión');
    if (text.includes('incendio')) terms.push('incendio lightning');
    if (text.includes('robo')) terms.push('robo hurto');
    if (text.includes('civil')) terms.push('responsabilidad civil');
    if (text.includes('equipo') || text.includes('maquinaria')) terms.push('equipo electrónico maquinaria');
    
    return terms.join(' ');
};

/**
 * Enrich a single alert with RAG evidence
 */
const enrichAlert = async (
    alert: any,
    insurerName: string,
    clientProfile?: ClientProfile
): Promise<EnrichedAlert> => {
    const searchQuery = extractSearchTerms(alert);
    
    try {
        // Search for relevant clause chunks
        const clauses = await ragRetrievalService.searchWithFallback(searchQuery, {
            insurerName,
            limit: 3
        });
        
        const evidence: Evidence[] = clauses.clauses.map((clause: RetrievedClause) => ({
            id: clause.id,
            documentId: clause.documentId,
            insurerName: clause.insurerName,
            sectionType: clause.sectionType,
            content: clause.content,
            pageNumber: clause.pageNumber,
            similarityScore: clause.similarity
        }));
        
        return {
            title: alert.title,
            description: alert.description,
            level: alert.level,
            insurerName,
            evidence,
            analysisType: evidence.length > 0 ? 'rag_enriched' : 'quote_based',
            businessContext: generateBusinessContext(alert, clientProfile)
        };
    } catch (error) {
        console.error(`❌ [auditEnrichment] Error enriching alert "${alert.title}":`, error);
        return {
            title: alert.title,
            description: alert.description,
            level: alert.level,
            insurerName,
            evidence: [],
            analysisType: 'quote_based',
            businessContext: generateBusinessContext(alert, clientProfile)
        };
    }
};

/**
 * Generate business context for an alert
 * Uses client profile when available for personalized context
 */
const generateBusinessContext = (alert: any, clientProfile?: ClientProfile): string => {
    const text = `${alert.title} ${alert.description}`.toLowerCase();
    
    if (text.includes('manufactura') || text.includes('fabricación') || text.includes('planta')) {
        return 'En manufactura, este riesgo puede afectar la continuidad operativa. Se recomienda verificar cobertura de lucro cesante.';
    }
    if (text.includes('comercio') || text.includes('tienda') || text.includes('retail')) {
        return 'En comercio, este riesgo impacta directamente el inventario y flujo de caja. Considerar cobertura de pérdida de beneficios.';
    }
    if (text.includes('servicio') || text.includes('consultoría') || text.includes('oficina')) {
        return 'En servicios, el impacto principal es la interrupción de operaciones. Verificar cobertura de gastos fijos.';
    }
    if (text.includes('construcción') || text.includes('obra')) {
        return 'En construcción, este riesgo puede causar retrasos significativos. Revisar cláusulas de daños a terceros y equipos.';
    }
    if (text.includes('transporte') || text.includes('logística')) {
        return 'En transporte y logística, la cadena de suministro es crítica. Verificar cobertura de mercancías en tránsito.';
    }
    
    // Use client profile for personalized context if available
    if (clientProfile) {
        const locationContext = getLocationContext(alert, clientProfile);
        if (locationContext) return locationContext;
        
        const industryContext = getIndustryContext(alert, clientProfile);
        if (industryContext) return industryContext;
    }
    
    return 'Este riesgo debe evaluarse según la naturaleza específica del negocio y su impacto en la operación.';
};

function getLocationContext(alert: any, profile: ClientProfile): string | null {
    const text = `${alert.title} ${alert.description}`.toLowerCase();
    
    if ((text.includes('inundación') || text.includes('inundacion')) && profile.locationZone === 'costera') {
        return 'El cliente está en zona costera con alta probabilidad de inundaciones. Esta exclusión representa un riesgo CRÍTICO específico para su ubicación.';
    }
    
    if (text.includes('terremoto') && profile.locationZone === 'montana') {
        return 'La ubicación en zona montañosa presenta riesgo sísmico elevado. Revisar cobertura de terremoto cuidadosamente.';
    }
    
    if (text.includes('robo') && profile.locationZone === 'urbana') {
        return 'En zona urbana, el riesgo de robo/hurto puede ser mayor. Verificar medidas de seguridad del local.';
    }
    
    return null;
}

function getIndustryContext(alert: any, profile: ClientProfile): string | null {
    const text = `${alert.title} ${alert.description}`.toLowerCase();
    
    if (text.includes('construcción') && profile.industryType === 'construccion') {
        return 'Como empresa del sector construcción, este riesgo es inherente a su actividad principal. Revisar coberturas especializadas.';
    }
    
    if ((text.includes('proveedor') || text.includes('suministro')) && profile.hasSingleSupplier) {
        return 'El cliente depende de un único proveedor. Esta exclusión deja desprotegida una vulnerabilidad crítica de su cadena de suministro.';
    }
    
    if (text.includes('equipo') && profile.industryType === 'manufactura') {
        return 'En manufactura, el equipo es crítico para la operación. Verificar cobertura de equipo electrónico y rotura de maquinaria.';
    }
    
    return null;
}

/**
 * Build cross-insurer risk comparison
 */
const buildCrossInsurerRisks = (alerts: EnrichedAlert[]): CrossInsurerRisk[] => {
    const riskMap: Map<string, CrossInsurerRisk> = new Map();
    
    alerts.forEach(alert => {
        const key = normalizeRiskKey(alert.title);
        
        if (riskMap.has(key)) {
            const existing = riskMap.get(key)!;
            if (!existing.affectedInsurers.includes(alert.insurerName)) {
                existing.affectedInsurers.push(alert.insurerName);
            }
            // Upgrade severity if needed
            if (alert.level === 'CRITICAL' && existing.severity !== 'CRITICAL') {
                existing.severity = 'CRITICAL';
            } else if (alert.level === 'WARNING' && existing.severity === 'GOOD') {
                existing.severity = 'WARNING';
            }
        } else {
            riskMap.set(key, {
                riskTitle: alert.title,
                riskDescription: alert.description,
                affectedInsurers: [alert.insurerName],
                severity: alert.level
            });
        }
    });
    
    return Array.from(riskMap.values())
        .filter(risk => risk.affectedInsurers.length > 1)
        .sort((a, b) => {
            const severityOrder = { CRITICAL: 0, WARNING: 1, GOOD: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
};

/**
 * Normalize risk title for grouping
 */
const normalizeRiskKey = (title: string): string => {
    return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 50);
};

/**
 * Main enrichment function
 */
export const enrichAuditAlerts = async (
    quotes: any[],
    clientProfile?: ClientProfile,
    onProgress?: ProgressCallback
): Promise<AuditEnrichmentResult> => {
    const insurerNames = quotes.map(q => q.insurerName).filter(Boolean);
    const hasClauses = await checkClausesAvailability(insurerNames);
    
    // Calculate total alerts for progress tracking
    const totalAlerts = quotes.reduce((sum, q) => sum + (q.alerts || []).length, 0);
    let processedCount = 0;
    
    const enrichedAlerts: EnrichedAlert[] = [];
    
    for (const quote of quotes) {
        const alerts = quote.alerts || [];
        
        for (const alert of alerts) {
            const enriched = await enrichAlert(alert, quote.insurerName, clientProfile);
            enrichedAlerts.push(enriched);
            
            // Report progress
            processedCount++;
            if (onProgress) {
                onProgress(processedCount, totalAlerts);
            }
        }
    }
    
    const crossInsurerRisks = buildCrossInsurerRisks(enrichedAlerts);
    
    // Generate overall business context analysis
    const criticalCount = enrichedAlerts.filter(a => a.level === 'CRITICAL').length;
    const warningCount = enrichedAlerts.filter(a => a.level === 'WARNING').length;
    
    let businessContextAnalysis = `Análisis de ${enrichedAlerts.length} hallazgos: `;
    if (criticalCount > 0) {
        businessContextAnalysis += `${criticalCount} riesgos críticos requieren atención inmediata. `;
    }
    if (warningCount > 0) {
        businessContextAnalysis += `${warningCount} advertencias identificadas. `;
    }
    if (crossInsurerRisks.length > 0) {
        businessContextAnalysis += `${crossInsurerRisks.length} riesgos afectan a múltiples aseguradoras, lo que facilita la negociación.`;
    }
    
    return {
        enrichedAlerts,
        hasClauses,
        crossInsurerRisks,
        businessContextAnalysis,
        progress: {
            current: processedCount,
            total: totalAlerts,
            percentage: totalAlerts > 0 ? Math.round((processedCount / totalAlerts) * 100) : 100
        }
    };
};

export default {
    enrichAuditAlerts,
    checkClausesAvailability
};
