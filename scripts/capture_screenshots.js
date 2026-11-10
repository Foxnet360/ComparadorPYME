const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const targetDir = path.resolve(__dirname, '../docs/manual/assets/screenshots');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const baseUrl = 'http://localhost:5178';

const targets = [
  { file: 'UI_01_LANDING_PAGE.png', url: `${baseUrl}/?view=LANDING`, wait: 2500 },
  { file: 'UI_02_LOGIN_SCREEN.png', url: `${baseUrl}/?view=LOGIN`, wait: 2000 },
  { file: 'UI_03_REGISTER_SCREEN.png', url: `${baseUrl}/?view=REGISTER`, wait: 2000 },
  { file: 'UI_04_PROFILE_SCREEN.png', url: `${baseUrl}/?demo=1&view=DASHBOARD&profile=1`, wait: 3000 },
  { file: 'UI_05_TECHNICAL_DASHBOARD.png', url: `${baseUrl}/?demo=1&view=DASHBOARD`, wait: 3000 },
  { file: 'UI_06_CLIENT_MANAGER.png', url: `${baseUrl}/?demo=1&view=CLIENTS`, wait: 3000 },
  { file: 'UI_07_NEW_AUDIT_SETUP.png', url: `${baseUrl}/?demo=1&view=ANALYZER`, wait: 2500 },
  { file: 'UI_08_FILE_UPLOAD_ZONE.png', url: `${baseUrl}/?demo=1&view=ANALYZER`, wait: 2500 },
  { file: 'UI_09_PROCESSING_PIPELINE.png', url: `${baseUrl}/?demo=1&view=ANALYZER&analyzing=1`, wait: 2500 },
  { file: 'UI_10_EXECUTIVE_SUMMARY_CARDS.png', url: `${baseUrl}/?demo=1&view=REPORT&reportTab=resumen`, wait: 3500 },
  { file: 'UI_11_UNIFIED_COVERAGE_MATRIX.png', url: `${baseUrl}/?demo=1&view=REPORT&reportTab=coberturas`, wait: 3500 },
  { file: 'UI_12_DEDUCTIBLE_RISK_ANALYSIS.png', url: `${baseUrl}/?demo=1&view=REPORT&reportTab=deducibles`, wait: 3500 },
  { file: 'UI_13_INSURER_RADAR_HEATMAP.png', url: `${baseUrl}/?demo=1&view=REPORT&reportTab=resumen`, wait: 3500 },
  { file: 'UI_14_LEGAL_OPINION_NEGOTIATION.png', url: `${baseUrl}/?demo=1&view=REPORT&reportTab=analisis-avanzado`, wait: 3500 },
  { file: 'UI_15_PDF_VIEWER_EVIDENCE.png', url: `${baseUrl}/?demo=1&view=REPORT&reportTab=coberturas`, wait: 3500 },
  { file: 'UI_16_MANUAL_CORRECTION.png', url: `${baseUrl}/?demo=1&view=REPORT&reportTab=auditoria`, wait: 3500 },
  { file: 'UI_17_SEGUROBOT_CHAT.png', url: `${baseUrl}/?demo=1&view=REPORT&chat=1`, wait: 3500 },
  { file: 'UI_18_CLAUSE_ADMIN_LIBRARY.png', url: `${baseUrl}/?demo=1&view=DASHBOARD&clauseAdmin=1`, wait: 3000 },
  { file: 'UI_19_PORTFOLIO_RENEWALS.png', url: `${baseUrl}/?demo=1&view=PORTFOLIO`, wait: 3000 },
  { file: 'UI_20_EXECUTIVE_ANALYTICS.png', url: `${baseUrl}/?demo=1&view=ANALYTICS`, wait: 3500 },
];

console.log(`Starting headless Chrome screenshot capture of ${targets.length} views...`);

for (const target of targets) {
  const outPath = path.join(targetDir, target.file);
  const cmd = `google-chrome --headless=new --screenshot="${outPath}" --window-size=1440,900 --virtual-time-budget=${target.wait} "${target.url}"`;
  try {
    execSync(cmd, { stdio: 'ignore' });
    const stats = fs.statSync(outPath);
    console.log(`✓ Captured ${target.file} (${(stats.size / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error(`✗ Error capturing ${target.file}:`, err.message);
  }
}

console.log('Capture complete!');
