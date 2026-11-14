import * as ExcelJS from 'exceljs';
import { BrokerDetails } from './types';

export const FONT_NAME = 'Segoe UI';

export const EXCEL_COLORS = {
  NAVY_HEADER: 'FF1E3A8A',
  NAVY_ACCENT: 'FF1E40AF',
  SLATE_DARK: 'FF0F172A',
  SLATE_BODY: 'FF1E293B',
  SLATE_LABEL: 'FF334155',
  SLATE_MUTED: 'FF475569',
  SLATE_LIGHT: 'FF64748B',
  BORDER_LIGHT: 'FFE2E8F0',
  BORDER_MEDIUM: 'FFCBD5E1',
  BG_LIGHT_GRAY: 'FFF8FAFC',
  BG_SLATE_HEADER: 'FFF1F5F9',
  BG_SECTION_HEADER: 'FFE2E8F0',
  WHITE: 'FFFFFFFF',
  // Status pastel colors
  EMERALD_BG: 'FFDEF7EC',
  EMERALD_TEXT: 'FF03543F',
  EMERALD_LIGHT_BG: 'FFD1FAE5',
  EMERALD_DARK_TEXT: 'FF065F46',
  YELLOW_BG: 'FFFEF08A',
  YELLOW_TEXT: 'FF713F12',
  YELLOW_LIGHT_BG: 'FFFEF9C3',
  YELLOW_DARK_TEXT: 'FF854D0E',
  RED_BG: 'FFFDE8E8',
  RED_TEXT: 'FF9B1C1C',
  RED_LIGHT_BG: 'FFFEE2E2',
  RED_DARK_TEXT: 'FF991B1B',
  AMBER_BG: 'FFFEF3C7',
  AMBER_TEXT: 'FF92400E',
  PURPLE_HEADER: 'FF6D28D9',
  PURPLE_NOTE: 'FF7C3AED',
  PURPLE_BG: 'FFF3E8FF',
  BLUE_LIGHT_BG: 'FFEFF6FF',
} as const;

export function applySheetHeaderFooter(
  ws: ExcelJS.Worksheet,
  sheetTitle: string,
  brokerDetails: BrokerDetails,
  todayStr: string
): void {
  ws.headerFooter = {
    oddHeader: `&L&B${brokerDetails.name}&C&"${FONT_NAME},Bold"${sheetTitle.toUpperCase()}&R${todayStr}`,
    oddFooter: `&L&B${brokerDetails.name}&B · Asesor: ${brokerDetails.advisor} · Tel: ${brokerDetails.phone} · ${brokerDetails.email} · Web: ${brokerDetails.website} · Reg. SFC: ${brokerDetails.reg}&R&P de &N`,
  };
}
