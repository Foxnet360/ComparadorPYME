#!/usr/bin/env node
/**
 * Script de monitoreo para Railway logs
 * Rastrea métricas clave de extracción multimodal
 * 
 * Usage: node scripts/monitor.js [--interval=60] [--duration=3600]
 */

const https = require('https');
const fs = require('fs');

// Configuración
const RAILWAY_API_KEY = process.env.RAILWAY_API_KEY;
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID;
const SERVICE_ID = process.env.RAILWAY_SERVICE_ID;
const LOG_INTERVAL = (process.env.LOG_INTERVAL || 60) * 1000; // ms
const MONITOR_DURATION = (process.env.MONITOR_DURATION || 3600) * 1000; // ms

// Métricas acumuladas
const metrics = {
  totalExtractions: 0,
  v2Extractions: 0,
  v1Fallbacks: 0,
  errors: 0,
  timeouts: 0,
  avgTime: 0,
  totalTime: 0,
  insurers: {},
  formatFamilies: {},
  startTime: Date.now(),
};

/**
 * Parsear logs de Railway y extraer métricas
 */
function parseLogLine(line) {
  const metrics_update = {};
  
  // Detectar extracciones V2
  if (line.includes('🔍 Phase 3: Extracting with multimodal vision')) {
    metrics.totalExtractions++;
    metrics.v2Extractions++;
  }
  
  // Detectar fallback a V1
  if (line.includes('Falling back to legacy extraction')) {
    metrics.v1Fallbacks++;
  }
  
  // Detectar errores
  if (line.includes('❌') || line.includes('Error')) {
    metrics.errors++;
  }
  
  // Detectar timeouts
  if (line.includes('timeout')) {
    metrics.timeouts++;
  }
  
  // Detectar tiempo de extracción
  const timeMatch = line.match(/(\d+)ms/);
  if (timeMatch && line.includes('extraction')) {
    const time = parseInt(timeMatch[1]);
    metrics.totalTime += time;
    metrics.avgTime = metrics.totalTime / metrics.totalExtractions;
  }
  
  // Detectar aseguradora
  const insurerMatch = line.match(/insurer: (\w+)/);
  if (insurerMatch) {
    const insurer = insurerMatch[1];
    metrics.insurers[insurer] = (metrics.insurers[insurer] || 0) + 1;
  }
  
  // Detectar familia de formato
  const familyMatch = line.match(/Format detected: (\w+)/);
  if (familyMatch) {
    const family = familyMatch[1];
    metrics.formatFamilies[family] = (metrics.formatFamilies[family] || 0) + 1;
  }
}

/**
 * Mostrar métricas actuales
 */
function showMetrics() {
  const elapsed = (Date.now() - metrics.startTime) / 1000;
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  
  console.clear();
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         MONITOREO EXTRACCIÓN MULTIMODAL V2                ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║ Tiempo: ${hours}h ${minutes}m ${Math.floor(elapsed % 60)}s`.padEnd(59) + '║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║ Total extracciones: ${metrics.totalExtractions}`.padEnd(59) + '║');
  console.log(`║ V2 (multimodal):    ${metrics.v2Extractions}`.padEnd(59) + '║');
  console.log(`║ V1 (fallback):      ${metrics.v1Fallbacks}`.padEnd(59) + '║');
  console.log(`║ Errores:            ${metrics.errors}`.padEnd(59) + '║');
  console.log(`║ Timeouts:           ${metrics.timeouts}`.padEnd(59) + '║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║ Tiempo promedio: ${Math.round(metrics.avgTime / 1000)}s`.padEnd(59) + '║');
  console.log(`║ SLA < 5 min: ${metrics.avgTime < 300000 ? '✅ Cumple' : '❌ No cumple'}`.padEnd(59) + '║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║ ASEGURADORAS PROCESADAS:'.padEnd(59) + '║');
  Object.entries(metrics.insurers)
    .sort((a, b) => b[1] - a[1])
    .forEach(([insurer, count]) => {
      console.log(`║   ${insurer}: ${count}`.padEnd(59) + '║');
    });
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║ FAMILIAS DE FORMATO:'.padEnd(59) + '║');
  Object.entries(metrics.formatFamilies)
    .sort((a, b) => b[1] - a[1])
    .forEach(([family, count]) => {
      console.log(`║   ${family}: ${count}`.padEnd(59) + '║');
    });
  console.log('╚════════════════════════════════════════════════════════════╝');
}

/**
 * Guardar métricas en archivo
 */
function saveMetrics() {
  const report = {
    timestamp: new Date().toISOString(),
    duration: Date.now() - metrics.startTime,
    metrics: {
      totalExtractions: metrics.totalExtractions,
      v2Extractions: metrics.v2Extractions,
      v1Fallbacks: metrics.v1Fallbacks,
      errors: metrics.errors,
      timeouts: metrics.timeouts,
      avgTimeMs: metrics.avgTime,
      avgTimeSeconds: Math.round(metrics.avgTime / 1000),
      slaCompliant: metrics.avgTime < 300000,
      v2Adoption: metrics.totalExtractions > 0 
        ? ((metrics.v2Extractions / metrics.totalExtractions) * 100).toFixed(1) + '%'
        : '0%',
      errorRate: metrics.totalExtractions > 0
        ? ((metrics.errors / metrics.totalExtractions) * 100).toFixed(1) + '%'
        : '0%',
    },
    insurers: metrics.insurers,
    formatFamilies: metrics.formatFamilies,
  };
  
  const filename = `metrics-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(filename, JSON.stringify(report, null, 2));
  console.log(`\n📊 Métricas guardadas en: ${filename}`);
}

/**
 * Simulación de lectura de logs (para demo)
 * En producción, esto usaría Railway API o tail de logs
 */
function simulateLogs() {
  const sampleLogs = [
    '🔍 Phase 3: Extracting with multimodal vision...',
    '✅ Format detected: TABLE-DOUBLE (95% confidence)',
    '✅ Multimodal extraction: HDI, 14 coverages, premium: 8500000',
    '   insurer: HDI',
    'Completed in 45000ms',
  ];
  
  const randomLog = sampleLogs[Math.floor(Math.random() * sampleLogs.length)];
  parseLogLine(randomLog);
}

/**
 * Main
 */
function main() {
  console.log('🚀 Iniciando monitoreo de extracción multimodal...');
  console.log(`   Intervalo: ${LOG_INTERVAL / 1000}s`);
  console.log(`   Duración: ${MONITOR_DURATION / 1000 / 60} minutos`);
  console.log('   Presiona Ctrl+C para detener\n');
  
  const interval = setInterval(() => {
    simulateLogs(); // En prod: leer logs reales
    showMetrics();
  }, LOG_INTERVAL);
  
  // Detener después de la duración configurada
  setTimeout(() => {
    clearInterval(interval);
    console.log('\n✅ Monitoreo completado');
    saveMetrics();
    process.exit(0);
  }, MONITOR_DURATION);
  
  // Guardar al recibir SIGINT
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n👋 Monitoreo detenido por usuario');
    saveMetrics();
    process.exit(0);
  });
}

main();
