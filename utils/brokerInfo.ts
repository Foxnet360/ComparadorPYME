import type { UserProfile } from '../types';

export type BrokerSourceUser = Partial<
  UserProfile & {
    intermediaryName?: string;
    agencyName?: string;
    registrationNumber?: string;
    phone?: string;
    address?: string;
    city?: string;
    logoUrl?: string;
  }
>;

export interface NormalizedBrokerInfo {
  name: string;
  intermediaryName: string;
  registrationNumber: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  logoUrl?: string;
  commercialPolicies?: UserProfile['commercialPolicies'];
}

export function buildBrokerInfo(user?: BrokerSourceUser | null): NormalizedBrokerInfo {
  return {
    name: user?.name || 'Técnico Analista de Seguros',
    intermediaryName:
      user?.intermediaryName || user?.agencyName || 'Corredores de Seguros Asociados S.A.',
    registrationNumber:
      user?.registrationNumber ||
      user?.agentDetails?.registrationNumber ||
      'Inscripción Vigente SFC',
    phone: user?.agentDetails?.phone || user?.phone || '+57 (601) 345-6789',
    email: user?.email || 'soporte@comparadorcsa.com',
    address: user?.address || user?.agentDetails?.address || 'Bogotá D.C., Colombia',
    city: user?.city || user?.agentDetails?.city || 'Bogotá D.C.',
    logoUrl: user?.logoUrl || user?.agentDetails?.logoUrl,
    commercialPolicies: user?.commercialPolicies,
  };
}
