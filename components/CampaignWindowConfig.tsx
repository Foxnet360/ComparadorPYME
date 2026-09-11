/**
 * CampaignWindowConfig (renovacion-polizas PR-5, task 1.23)
 *
 * R4.1: brokers configure expiration campaign windows (days before the
 * policy end_date) and toggle automation. Loads via GET /api/campaigns/config
 * (defaults 60/30/7 when nothing is persisted) and saves via PUT.
 */

import React, { useEffect, useState } from 'react';
import { getCampaignConfig, saveCampaignConfig } from '../services/portfolioService';

/** Windows are positive whole days, bounded exactly like the API (1..365). */
function parseWindows(raw: string): number[] | null {
  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return null;
  const windows: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const days = Number(part);
    if (days < 1 || days > 365) return null;
    windows.push(days);
  }
  return windows;
}

export const CampaignWindowConfig: React.FC = () => {
  const [windowsText, setWindowsText] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const config = await getCampaignConfig();
        if (cancelled) return;
        setWindowsText(config.windows.join(', '));
        setEnabled(config.enabled);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaved(false);
    const windows = parseWindows(windowsText);
    if (!windows) {
      setError('Ventanas inválidas: usa números enteros entre 1 y 365 separados por comas.');
      return;
    }
    setError(null);
    try {
      const config = await saveCampaignConfig({ windows, enabled });
      setWindowsText(config.windows.join(', '));
      setEnabled(config.enabled);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (loading) {
    return <p role="status">Cargando configuración de campañas…</p>;
  }

  return (
    <form
      aria-label="Configuración de campañas de vencimiento"
      onSubmit={handleSave}
      className="space-y-3"
    >
      {error && <p role="alert">{error}</p>}
      {saved && <p role="status">Configuración guardada.</p>}

      <div>
        <label htmlFor="campaign-windows" className="block text-sm font-medium text-slate-700">
          Ventanas (días antes del vencimiento, separadas por comas)
        </label>
        <input
          id="campaign-windows"
          value={windowsText}
          onChange={(e) => {
            setWindowsText(e.target.value);
            setSaved(false);
          }}
          className="border border-slate-300 rounded px-3 py-2 w-full"
          placeholder="60, 30, 7"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="campaign-enabled"
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            setSaved(false);
          }}
        />
        <label htmlFor="campaign-enabled" className="text-sm text-slate-700">
          Campañas automáticas habilitadas
        </label>
      </div>

      <button
        type="submit"
        className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700"
      >
        Guardar configuración
      </button>
    </form>
  );
};

export default CampaignWindowConfig;
