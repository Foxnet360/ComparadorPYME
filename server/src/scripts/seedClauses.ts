/**
 * Seed Clausulados - CLI interactivo para carga masiva de clausulados
 *
 * Escanea directorios de ejemplos y permite cargar clausulados de forma
 * interactiva o mediante manifest.json
 *
 * Usage:
 *   Interactivo:  cd server && npx ts-node src/scripts/seedClauses.ts
 *   Batch:        cd server && npx ts-node src/scripts/seedClauses.ts --manifest manifest.json
 *   Resumir:      cd server && npx ts-node src/scripts/seedClauses.ts --resume seed-state.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as readline from 'readline';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Configuración
const EXAMPLES_DIR = path.join(__dirname, '../../../Ejemplos');
const STATE_FILE = path.join(__dirname, '../../seed-state.json');

// Tipos
type DocumentType = 'CLAUSULADO_GENERAL' | 'CLAUSULADO_PARTICULAR' | 'ANEXO';

interface SeedState {
  completed: string[]; // file hashes
  failed: Array<{ file: string; error: string }>;
  lastRun: string;
}

interface ManifestEntry {
  filePath: string;
  insurerName: string;
  documentName: string;
  documentType: DocumentType;
  productName: string;
  version?: string;
}

interface Manifest {
  entries: ManifestEntry[];
}

// Utilidades
function getFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

function loadState(): SeedState {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  }
  return { completed: [], failed: [], lastRun: new Date().toISOString() };
}

function saveState(state: SeedState) {
  state.lastRun = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function findPdfFiles(): string[] {
  const pdfs: string[] = [];

  function scanDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name.toLowerCase().endsWith('.pdf')) {
        pdfs.push(fullPath);
      }
    }
  }

  if (fs.existsSync(EXAMPLES_DIR)) {
    scanDir(EXAMPLES_DIR);
  }

  return pdfs.sort();
}

function detectInsurerFromFilename(filename: string): string | null {
  const name = path.basename(filename, '.pdf');

  // Patrones comunes
  const patterns = [
    /Clausulado\s*[-–]\s*(.+)/i,
    /CLAUSULADO\s+(.+)/i,
    /Cotizaci[oó]n\s*[-–]\s*(.+)/i,
    /COTIZACION\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

function detectDocumentTypeFromPath(filePath: string): DocumentType {
  const dir = path.dirname(filePath).toLowerCase();

  if (dir.includes('clausulado') || dir.includes('clausulados')) {
    return 'CLAUSULADO_GENERAL';
  } else if (dir.includes('cotizacion') || dir.includes('cotizaciones')) {
    return 'CLAUSULADO_PARTICULAR';
  } else if (dir.includes('anexo') || dir.includes('anexos')) {
    return 'ANEXO';
  }

  return 'CLAUSULADO_GENERAL';
}

// CLI interactiva
function askQuestion(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function interactivePrompt(
  filePath: string,
  state: SeedState
): Promise<ManifestEntry | null> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const fileHash = getFileHash(filePath);

    // Verificar si ya fue procesado
    if (state.completed.includes(fileHash)) {
      console.log(`  ⏭️  Ya procesado (hash: ${fileHash.substring(0, 8)}...)`);
      return null;
    }

    const filename = path.basename(filePath);
    const detectedInsurer = detectInsurerFromFilename(filename);
    const detectedType = detectDocumentTypeFromPath(filePath);

    console.log(`\n📄 ${filename}`);
    console.log(`   Ruta: ${path.relative(EXAMPLES_DIR, filePath)}`);
    console.log(`   Tamaño: ${(fs.statSync(filePath).size / 1024).toFixed(1)} KB`);
    console.log(`   Hash: ${fileHash.substring(0, 8)}...`);

    // Sugerir nombre de aseguradora
    let insurerName = detectedInsurer || '';
    if (insurerName) {
      const confirm = await askQuestion(
        rl,
        `   Aseguradora detectada: "${insurerName}" ¿Correcto? (s/n): `
      );
      if (confirm.toLowerCase() !== 's' && confirm.toLowerCase() !== 'si') {
        insurerName = await askQuestion(rl, '   Nombre de la aseguradora: ');
      }
    } else {
      insurerName = await askQuestion(rl, '   Nombre de la aseguradora: ');
    }

    if (!insurerName) {
      console.log('   ❌ Saltando (sin aseguradora)');
      return null;
    }

    // Nombre del producto
    const productName = await askQuestion(rl, '   Nombre del producto (ej: Póliza PYME): ');

    // Tipo de documento
    console.log('   Tipo de documento:');
    console.log('     1 = Clausulado General');
    console.log('     2 = Clausulado Particular');
    console.log('     3 = Anexo');
    const typeChoice = await askQuestion(
      rl,
      `   Selección [${detectedType === 'CLAUSULADO_GENERAL' ? '1' : detectedType === 'CLAUSULADO_PARTICULAR' ? '2' : '3'}]: `
    );

    let documentType: DocumentType;
    switch (typeChoice.trim()) {
      case '2':
        documentType = 'CLAUSULADO_PARTICULAR';
        break;
      case '3':
        documentType = 'ANEXO';
        break;
      default:
        documentType = 'CLAUSULADO_GENERAL';
    }

    // Versión
    const version = await askQuestion(rl, '   Versión (ej: 2024.1) [opcional]: ');

    // Nombre del documento
    const documentName = await askQuestion(
      rl,
      `   Nombre del documento [${path.basename(filename, '.pdf')}]: `
    );

    return {
      filePath,
      insurerName: insurerName.trim(),
      documentName: (documentName || path.basename(filename, '.pdf')).trim(),
      documentType,
      productName: (productName || 'General').trim(),
      version: version.trim() || undefined,
    };
  } finally {
    rl.close();
  }
}

// Procesar un archivo
async function processFile(entry: ManifestEntry, state: SeedState): Promise<boolean> {
  try {
    // Importar servicio dinámicamente para evitar error de Supabase al generar manifest
    const { documentIndexingService } = await import('../services/documentIndexingService');

    console.log(`\n🚀 Indexando: ${path.basename(entry.filePath)}`);
    console.log(`   Aseguradora: ${entry.insurerName}`);
    console.log(`   Producto: ${entry.productName}`);
    console.log(`   Tipo: ${entry.documentType}`);
    console.log(`   Versión: ${entry.version || 'N/A'}`);

    const metadata = {
      insurerName: entry.insurerName,
      documentName: entry.documentName,
      documentType: entry.documentType,
      productName: entry.productName,
      version: entry.version,
      uploadedBy: 'seed-script',
    };

    const result = await documentIndexingService.indexDocument(entry.filePath, metadata);

    if (result.success) {
      console.log(`   ✅ Éxito! Document ID: ${result.documentId}`);
      console.log(`      Páginas: ${result.stats.totalPages}`);
      console.log(`      Chunks: ${result.stats.chunksCreated}`);
      console.log(`      Tiempo: ${result.stats.processingTimeMs}ms`);

      const fileHash = getFileHash(entry.filePath);
      state.completed.push(fileHash);
      return true;
    } else {
      console.error(`   ❌ Error: ${result.errors.join(', ')}`);
      state.failed.push({ file: entry.filePath, error: result.errors.join(', ') });
      return false;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`   ❌ Error inesperado: ${message}`);
    state.failed.push({ file: entry.filePath, error: message });
    return false;
  }
}

// Modo interactivo
async function runInteractive(files: string[], state: SeedState) {
  console.log('\n🌱 Seed Clausulados - Modo Interactivo');
  console.log(`   Encontrados ${files.length} archivos PDF`);
  console.log('   Presiona Ctrl+C para cancelar en cualquier momento\n');

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`\n[${i + 1}/${files.length}]`);

    const entry = await interactivePrompt(file, state);

    if (!entry) {
      skipped++;
      continue;
    }

    // Confirmar antes de indexar
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const confirm = await new Promise<string>((resolve) => {
      rl.question('   ¿Proceder con indexación? (s/n): ', (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase());
      });
    });

    if (confirm === 's' || confirm === 'si') {
      const success = await processFile(entry, state);
      if (success) {
        processed++;
      } else {
        failed++;
      }

      // Guardar estado después de cada archivo
      saveState(state);
    } else {
      console.log('   ⏭️  Saltando');
      skipped++;
    }
  }

  console.log('\n📊 Resumen:');
  console.log(`   Procesados: ${processed}`);
  console.log(`   Saltados: ${skipped}`);
  console.log(`   Fallidos: ${failed}`);
  console.log(`   Total: ${files.length}`);
}

// Modo batch (manifest)
async function runBatch(manifestPath: string, state: SeedState, resume: boolean) {
  console.log('\n🌱 Seed Clausulados - Modo Batch');

  const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  console.log(`   Manifest: ${manifest.entries.length} entradas`);

  if (resume) {
    console.log(`   Resumiendo: ${state.completed.length} ya procesados`);
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < manifest.entries.length; i++) {
    const entry = manifest.entries[i];
    console.log(`\n[${i + 1}/${manifest.entries.length}] ${path.basename(entry.filePath)}`);

    // Verificar si ya fue procesado
    if (resume) {
      const fileHash = getFileHash(entry.filePath);
      if (state.completed.includes(fileHash)) {
        console.log('   ⏭️  Ya procesado');
        skipped++;
        continue;
      }
    }

    const success = await processFile(entry, state);
    if (success) {
      processed++;
    } else {
      failed++;
    }

    // Guardar estado después de cada archivo
    saveState(state);
  }

  console.log('\n📊 Resumen:');
  console.log(`   Procesados: ${processed}`);
  console.log(`   Saltados: ${skipped}`);
  console.log(`   Fallidos: ${failed}`);
  console.log(`   Total: ${manifest.entries.length}`);
}

// Generar manifest de ejemplo
function generateManifest(files: string[], outputPath: string) {
  const entries: ManifestEntry[] = files.map((file) => {
    const detectedInsurer = detectInsurerFromFilename(file);
    const detectedType = detectDocumentTypeFromPath(file);

    return {
      filePath: file,
      insurerName: detectedInsurer || 'NOMBRE_ASEGURADORA',
      documentName: path.basename(file, '.pdf'),
      documentType: detectedType,
      productName: 'General',
      version: '2024.1',
    };
  });

  const manifest: Manifest = { entries };
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
  console.log(`\n📝 Manifest generado: ${outputPath}`);
  console.log(`   ${entries.length} entradas`);
  console.log('   Edita el archivo antes de ejecutar en modo batch');
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const manifestFlag = args.find((arg) => arg.startsWith('--manifest='));
  const resumeFlag = args.includes('--resume');
  const generateManifestFlag = args.includes('--generate-manifest');

  const state = loadState();

  console.log('🌱 Seed Clausulados v1.0');
  console.log('========================');

  // Encontrar archivos PDF
  const files = findPdfFiles();

  if (files.length === 0) {
    console.error('❌ No se encontraron archivos PDF en', EXAMPLES_DIR);
    process.exit(1);
  }

  console.log(`📁 Directorio: ${EXAMPLES_DIR}`);
  console.log(`📄 PDFs encontrados: ${files.length}`);

  if (generateManifestFlag) {
    const outputPath = path.join(__dirname, '../../manifest-example.json');
    generateManifest(files, outputPath);
    return;
  }

  if (manifestFlag) {
    const manifestPath = manifestFlag.split('=')[1];
    await runBatch(manifestPath, state, resumeFlag);
  } else {
    await runInteractive(files, state);
  }

  console.log('\n✨ Completado!');
  console.log(`💾 Estado guardado en: ${STATE_FILE}`);
}

main().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
