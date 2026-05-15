export interface Benchmark {
  name: string;
  data: {
    type: string;
    value: number;
    min?: string;
  };
  notes: string;
}

export const DEDUCTIBLE_BENCHMARKS: Record<string, Benchmark[]> = {
  'Incendio (Edificio y Contenidos)': [
    {
      name: 'excellent',
      data: { type: 'percentage', value: 5 },
      notes: 'Menos de 5% es excelente. Reduce costos en siniestros menores.'
    },
    {
      name: 'standard',
      data: { type: 'percentage', value: 10 },
      notes: 'Estándar de mercado: 10% del valor del siniestro.'
    },
    {
      name: 'poor',
      data: { type: 'percentage', value: 20 },
      notes: 'Más de 20% es desfavorable. Considerar negociar reducción.'
    }
  ],
  'Terremoto y Eventos Catastróficos': [
    {
      name: 'excellent',
      data: { type: 'percentage', value: 10, min: '2 SMMLV' },
      notes: 'Mínimo bajo. Reduce barrera para reclamar en siniestros pequeños.'
    },
    {
      name: 'standard',
      data: { type: 'percentage', value: 10, min: '5 SMMLV' },
      notes: 'Estándar de mercado: 10% con mínimo de 5 SMMLV ($6.5M COP).'
    },
    {
      name: 'poor',
      data: { type: 'percentage', value: 15, min: '10 SMMLV' },
      notes: 'Elevado. Mínimo alto desincentiva reclamos menores.'
    }
  ],
  'Responsabilidad Civil (RCE)': [
    {
      name: 'excellent',
      data: { type: 'percentage', value: 0 },
      notes: 'Deducible 0% es ideal para RC. Cubre desde el primer peso.'
    },
    {
      name: 'standard',
      data: { type: 'percentage', value: 0 },
      notes: 'RC debería tener deducible 0% o muy bajo por naturaleza del riesgo.'
    },
    {
      name: 'poor',
      data: { type: 'percentage', value: 5 },
      notes: 'RC con deducible es desfavorable. Afecta relación con terceros.'
    }
  ],
  'Sustracción / Hurto': [
    {
      name: 'excellent',
      data: { type: 'percentage', value: 5 },
      notes: 'Bajo deducible incentiva uso de la cobertura.'
    },
    {
      name: 'standard',
      data: { type: 'percentage', value: 10 },
      notes: 'Estándar de mercado para hurto y sustracción.'
    },
    {
      name: 'poor',
      data: { type: 'percentage', value: 15 },
      notes: 'Elevado. Considerar negociar para activos de alto valor.'
    }
  ],
  'Equipo Eléctrico y Electrónico': [
    {
      name: 'excellent',
      data: { type: 'percentage', value: 5 },
      notes: 'Bajo deducible para equipos sensibles.'
    },
    {
      name: 'standard',
      data: { type: 'percentage', value: 10 },
      notes: 'Estándar de mercado para equipo eléctrico y electrónico.'
    },
    {
      name: 'poor',
      data: { type: 'percentage', value: 20 },
      notes: 'Elevado. Equipos electrónicos tienen siniestros frecuentes.'
    }
  ],
  'Rotura de Maquinaria': [
    {
      name: 'excellent',
      data: { type: 'percentage', value: 5 },
      notes: 'Bajo deducible para maquinaria crítica.'
    },
    {
      name: 'standard',
      data: { type: 'percentage', value: 10 },
      notes: 'Estándar de mercado para rotura de maquinaria.'
    },
    {
      name: 'poor',
      data: { type: 'percentage', value: 20 },
      notes: 'Elevado. Maquinaria tiene siniestros costosos.'
    }
  ],
  'Huelga, Motín, Asonada (HMACC)': [
    {
      name: 'excellent',
      data: { type: 'percentage', value: 5 },
      notes: 'Bajo deducible para eventos sociales.'
    },
    {
      name: 'standard',
      data: { type: 'percentage', value: 10 },
      notes: 'Estándar de mercado para HMACC.'
    },
    {
      name: 'poor',
      data: { type: 'percentage', value: 15 },
      notes: 'Elevado. Eventos HMACC pueden afectar extensas áreas.'
    }
  ]
};

export const deductibleBenchmarks = {
  /**
   * Get benchmarks for a coverage type
   */
  getBenchmarks(coverageType: string): Benchmark[] {
    return DEDUCTIBLE_BENCHMARKS[coverageType] || [];
  },

  /**
   * Evaluate deductible against benchmarks
   */
  evaluate(
    coverageType: string,
    deductible: { percentage: number; minAmount?: number }
  ): {
    benchmark: string;
    assessment: string;
    notes: string;
  } {
    const benchmarks = this.getBenchmarks(coverageType);
    
    if (benchmarks.length === 0) {
      return {
        benchmark: 'unknown',
        assessment: 'No benchmark available',
        notes: 'No hay benchmarks definidos para este tipo de cobertura'
      };
    }
    
    const standard = benchmarks.find(b => b.name === 'standard');
    const excellent = benchmarks.find(b => b.name === 'excellent');
    const poor = benchmarks.find(b => b.name === 'poor');
    
    // Compare against benchmarks
    if (excellent && deductible.percentage <= excellent.data.value) {
      return {
        benchmark: 'excellent',
        assessment: 'Excelente',
        notes: excellent.notes
      };
    }
    
    if (poor && deductible.percentage >= poor.data.value) {
      return {
        benchmark: 'poor',
        assessment: 'Desfavorable',
        notes: poor.notes
      };
    }
    
    return {
      benchmark: 'standard',
      assessment: 'Estándar de mercado',
      notes: standard?.notes || 'Dentro del rango esperado'
    };
  },

  /**
   * Calculate expected deductible cost
   */
  calculateExpectedCost(
    deductible: { minAmount: number; maxAmount: number; percentage: number; isPercentageBased: boolean },
    claimProbability: number,
    averageClaimAmount: number
  ): number {
    let expectedDeductible = 0;
    
    if (deductible.isPercentageBased) {
      const calculatedAmount = (deductible.percentage / 100) * averageClaimAmount;
      expectedDeductible = Math.min(
        deductible.maxAmount || Infinity,
        Math.max(deductible.minAmount, calculatedAmount)
      );
    } else {
      expectedDeductible = deductible.minAmount;
    }
    
    return claimProbability * expectedDeductible;
  }
};

export default deductibleBenchmarks;
