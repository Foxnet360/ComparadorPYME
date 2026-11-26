export type CumplimientoCaseType = 'LICITACION' | 'CONTRATO' | 'OTROSI';

export type CumplimientoCaseStatus =
  | 'DRAFT'
  | 'READY_TO_QUOTE'
  | 'QUOTED'
  | 'VALIDATED'
  | 'ISSUED'
  | 'MODIFICATION_PENDING'
  | 'CLOSED';

export type CumplimientoLegalRegime = 'ESTATAL_LEY_80' | 'PARTICULAR' | 'REGIMEN_ESPECIAL';

export type CumplimientoContractType =
  | 'PRESTACION_SERVICIOS'
  | 'OBRA'
  | 'SUMINISTRO'
  | 'ORDEN_DE_COMPRA'
  | 'ORDEN_DE_SERVICIO'
  | 'CONVENIO'
  | 'LICITACION'
  | 'OTRO';

export type CumplimientoPersonType = 'NATURAL' | 'JURIDICA' | 'CONSORCIO' | 'UNION_TEMPORAL';

export interface CumplimientoConsortiumMember {
  name: string;
  nit: string;
  participationPercent: number;
}

export interface CumplimientoRequiredCoverageItem {
  id: string;
  name: string;
  canonicalName?: string | null;
  percentageOfContract?: string | null;
  percentageNumeric?: number | null;
  minimumAmount?: number | null;
  baseValidity?: string | null;
  additionalValidity?: string | null;
  validityRule?: string | null;
  estimatedStartDate?: string | null;
  estimatedEndDate?: string | null;
  isMandatory: boolean;
  notes?: string | null;
  rawTextSnippet?: string | null;
  pageNumber?: number | null;
}

export interface CumplimientoRceRequirement {
  required: boolean;
  amountDescription?: string | null;
  amountCop?: number | null;
  amountSmmlv?: number | null;
  subcoverages: string[];
  maxDeductibleRule?: string | null;
  validityRule?: string | null;
}

export interface CumplimientoModificationDetails {
  modificationType: 'ADICION' | 'PRORROGA' | 'ACLARACION' | 'SUSPENSION' | 'CESION';
  basePolicyNumber?: string | null;
  addedValue?: number | null;
  newTotalContractValue?: number | null;
  newEndDate?: string | null;
  extensionTerm?: string | null;
  justification?: string | null;
}

export interface CumplimientoDecreto1082Alert {
  id: string;
  ruleCode: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  coverageName?: string | null;
  message: string;
  recommendation?: string | null;
}

export interface CumplimientoPrepolicyData {
  caseType: CumplimientoCaseType;
  legalRegime: CumplimientoLegalRegime;
  contractType: CumplimientoContractType;
  contractNumber: string;
  secopProcessNumber?: string | null;
  objectDescription: string;
  contractValue: number | null;
  includesIva?: boolean | null;
  advancePaymentPercent?: number | null;
  advancePaymentAmount?: number | null;
  contractDuration: string;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  liquidationTerm?: string | null;
  paymentTerms?: string | null;
  penalClause?: string | null;
  finesClause?: string | null;
  contractor: {
    name: string;
    nit: string;
    personType: CumplimientoPersonType;
    address?: string | null;
    city?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    ciiuCode?: string | null;
    consortiumMembers?: CumplimientoConsortiumMember[];
  };
  beneficiary: {
    name: string;
    nit: string;
    address?: string | null;
    city?: string | null;
  };
  requiredCoverages: CumplimientoRequiredCoverageItem[];
  rceRequirement?: CumplimientoRceRequirement;
  modificationDetails?: CumplimientoModificationDetails | null;
  decreto1082Alerts: CumplimientoDecreto1082Alert[];
  specialObservations?: string | null;
}

export type CumplimientoChecklistStatus = 'pending' | 'received' | 'verified' | 'na';

export interface CumplimientoChecklistItem {
  id: string;
  code: string;
  category: 'BASE' | 'JURIDICA' | 'NATURAL' | 'CONSORCIO' | 'SARLAFT' | 'POST_EMISION';
  label: string;
  required: boolean;
  status: CumplimientoChecklistStatus;
  issueDate?: string | null;
  maxAgeDays?: number | null;
  expiryWarning?: string | null;
  notes?: string | null;
}

export interface CumplimientoFieldCheck {
  fieldKey: string;
  fieldLabel: string;
  block: 'PARTES' | 'CONTRATO' | 'AMPAROS' | 'RCE' | 'CLAUSULADO';
  expectedValue: string;
  foundValue: string;
  status: 'MATCH' | 'MISMATCH' | 'MISSING' | 'REVIEW';
  severity: 'INFO' | 'WARNING' | 'BLOCKING';
  insurerName?: string | null;
  detail?: string | null;
}

export interface CumplimientoQuoteEconomicRow {
  insurerName: string;
  fileName: string;
  premiumAnnual: number | null;
  ratePercent: number | null;
  minimumPremiumApplied?: boolean | null;
  paymentTerms?: string | null;
  counterGuarantee?: string | null;
  blockingGapsCount: number;
  reviewCount: number;
  overallStatus: 'COMPLIANT' | 'PARTIAL_GAP' | 'REJECTED_RISK';
}

export type CumplimientoValidationTarget = 'COTIZACION' | 'BORRADOR_POLIZA' | 'ANEXO_MODIFICACION';

export interface CumplimientoValidationRecord {
  id: string;
  validatedAt: string;
  validationTarget: CumplimientoValidationTarget;
  quoteFileNames: string[];
  clauseIdsUsed: string[];
  overallStatus: 'COMPLIANT' | 'PARTIAL_GAP' | 'REJECTED_RISK';
  summary: string;
  fieldChecks: CumplimientoFieldCheck[];
  economicComparison: CumplimientoQuoteEconomicRow[];
  correctionMessage: string;
}

export interface CumplimientoCase {
  id: string;
  user_id: string;
  org_id: string | null;
  client_id: string | null;
  parent_case_id: string | null;
  policy_id: string | null;
  case_type: CumplimientoCaseType;
  status: CumplimientoCaseStatus;
  title: string;
  legal_regime: CumplimientoLegalRegime | null;
  contract_type: string | null;
  contract_number: string | null;
  contractor_name: string | null;
  contractor_nit: string | null;
  entity_name: string | null;
  entity_nit: string | null;
  contract_value: number | null;
  governing_document_names: string[];
  prepolicy_data: CumplimientoPrepolicyData;
  checklist_data: CumplimientoChecklistItem[];
  validation_history: CumplimientoValidationRecord[];
  created_at: string;
  updated_at: string;
}
