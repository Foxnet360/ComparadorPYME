import * as ExcelJS from 'exceljs';
import { QuoteAnalysis, MatrixRow } from '../../types';
import { CommercialPolicies } from '../../shared/commercialPolicies';
import { getDomainRegulatoryProfile } from '../../shared/domainRegulatoryKnowledge';

export interface ClientInfo {
  name?: string;
  activity?: string;
  location?: string;
  nit?: string;
}

export interface ExcelReportData {
  matrix?: MatrixRow[];
  [key: string]: unknown;
}

export interface BrokerInfo {
  name?: string;
  intermediaryName?: string;
  registrationNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  logoUrl?: string;
  commercialPolicies?: CommercialPolicies;
}

export interface BrokerDetails {
  name: string;
  advisor: string;
  phone: string;
  email: string;
  reg: string;
  address: string;
  city: string;
  website: string;
}

export interface ExcelContext {
  workbook: ExcelJS.Workbook;
  quotes: QuoteAnalysis[];
  clientInfo?: ClientInfo;
  cellNotes?: Record<string, string>;
  brokerInfo?: BrokerInfo;
  domain: string;
  reportData?: ExcelReportData;
  mode: 'technical' | 'client';
  hasNotes: boolean;
  regulatoryProfile: ReturnType<typeof getDomainRegulatoryProfile>;
  matrix: MatrixRow[];
  insurerImageIds: (number | null)[];
  clientName: string;
  clientActivity: string;
  clientLocation: string;
  maxAsset: number;
  totalAssetValueStr: string;
  bestQuote: QuoteAnalysis;
  brokerDetails: BrokerDetails;
  todayStr: string;
}
