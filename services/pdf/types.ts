import type jsPDF from 'jspdf';
import type { ComparisonReport } from '../../types';
import type { CommercialPolicies } from '../../src/data/commercialPolicies';
import type { DomainRegulatoryProfile } from '@shared/domainRegulatoryKnowledge';

export interface BrokerInfo {
  name?: string;
  intermediaryName?: string;
  registrationNumber?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  logoUrl?: string;
  commercialPolicies?: CommercialPolicies;
}

export interface PDFOptions {
  logoBase64?: string;
  customTitle?: string;
  primaryColor?: [number, number, number];
  brokerInfo?: BrokerInfo;
  commercialPolicies?: CommercialPolicies;
  mode?: 'condensed' | 'extended';
  condensed?: boolean;
}

export interface DocWithAutoTable {
  lastAutoTable?: { finalY: number };
}

export type HeaderRenderer = (title: string) => number;

export interface TableMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface ClientRiskMetadata {
  clientName: string;
  riskAddress: string;
  riskCity: string;
  buildingDetails: string;
}

export interface PdfRenderContext {
  doc: jsPDF;
  report: ComparisonReport;
  options?: PDFOptions;
  today: string;
  domain: string;
  regProfile: DomainRegulatoryProfile;
  primaryColor: [number, number, number];
  lightGray: [number, number, number];
  tableMargins: TableMargins;
  pagesWithHeader: Set<number>;
  addHeader: HeaderRenderer;
  isCondensed: boolean;
  effectivePolicies: CommercialPolicies;
  quotes: NonNullable<ComparisonReport['quotes']>;
  insurers: string[];
  clientMeta: ClientRiskMetadata;
  brokerName: string;
}
