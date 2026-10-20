import React, { useState } from 'react';
import { insurerService, type InsurerEntity } from '../../services/insurerService';

export interface InsurerLogoProps {
  insurerName?: string | null;
  logoUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showName?: boolean;
  showBadge?: boolean;
  showRpaBadge?: boolean;
  className?: string;
  onClick?: () => void;
}

const SIZE_CONFIGS = {
  xs: { box: 'w-6 h-6', img: 'w-5 h-5', text: 'text-xs', pillText: 'text-[9px]' },
  sm: { box: 'w-8 h-8', img: 'w-6 h-6', text: 'text-sm font-semibold', pillText: 'text-[10px]' },
  md: { box: 'w-10 h-10', img: 'w-8 h-8', text: 'text-sm font-bold', pillText: 'text-[11px]' },
  lg: { box: 'w-14 h-14', img: 'w-11 h-11', text: 'text-base font-bold', pillText: 'text-xs' },
  xl: { box: 'w-20 h-20', img: 'w-16 h-16', text: 'text-lg font-extrabold', pillText: 'text-xs' },
};

export const InsurerLogo: React.FC<InsurerLogoProps> = ({
  insurerName,
  logoUrl,
  size = 'md',
  showName = false,
  showBadge = false,
  showRpaBadge = false,
  className = '',
  onClick,
}) => {
  const [imageError, setImageError] = useState(false);
  const brand: InsurerEntity = insurerService.resolveInsurerBrand(insurerName);
  const cfg = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;

  const resolvedLogo = !imageError && (logoUrl || brand.logoUrl);

  return (
    <div
      className={`inline-flex items-center gap-2.5 ${onClick ? 'cursor-pointer select-none hover:opacity-90' : ''} ${className}`}
      onClick={onClick}
      title={`${brand.name} (${brand.officialName || brand.name}) — ${brand.marketPosition}`}
    >
      <div
        className={`relative flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${cfg.box} transition-transform hover:scale-105`}
        style={{
          borderLeftColor: brand.primaryColor || '#0284C7',
          borderLeftWidth: '3px',
        }}
      >
        {resolvedLogo ? (
          <img
            src={resolvedLogo}
            alt={brand.name}
            className={`object-contain ${cfg.img}`}
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <img
            src={brand.svgBadgeUri}
            alt={brand.monogram || brand.name}
            className={`object-cover ${cfg.box}`}
          />
        )}
      </div>

      {showName && (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-slate-800 dark:text-slate-100 truncate ${cfg.text}`}>
              {brand.shortName || brand.name}
            </span>
            {showRpaBadge && (brand.rpaEnabled || brand.apiEnabled) && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-full font-medium ${
                  brand.rpaEnabled
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                } ${cfg.pillText}`}
                title={brand.integrationInfo}
              >
                {brand.rpaEnabled ? 'RPA Rocketbot' : 'API Directa'}
              </span>
            )}
          </div>
          {showBadge && brand.marketPosition && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
              {brand.marketPosition}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
