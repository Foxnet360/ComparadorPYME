#!/usr/bin/env node

/**
 * Railway Deploy Validator
 * Valida el proyecto antes de deployar a Railway
 * Detecta errores comunes que causan fallos en build
 */

const fs = require('fs');
const { execSync } = require('child_process');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function checkDependencies() {
  log('\n📦 Verificando dependencias...', YELLOW);
  
  const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const serverPkg = JSON.parse(fs.readFileSync('server/package.json', 'utf8'));
  
  const rootDeps = { ...rootPkg.dependencies, ...rootPkg.devDependencies };
  const serverDeps = serverPkg.dependencies || {};
  
  const missing = Object.keys(serverDeps).filter(dep => !rootDeps[dep]);
  
  if (missing.length > 0) {
    log(`❌ Faltan dependencias en package.json raiz:`, RED);
    missing.forEach(dep => log(`   - ${dep}@${serverDeps[dep]}`, RED));
    log('\n💡 Solucion: Agrega estas dependencias al package.json raiz', YELLOW);
    return false;
  }
  
  log('✅ Todas las dependencias estan sincronizadas', GREEN);
  return true;
}

function checkLockFile() {
  log('\n🔒 Verificando package-lock.json...', YELLOW);
  
  try {
    // Check if package-lock.json exists
    if (!fs.existsSync('package-lock.json')) {
      log('❌ No existe package-lock.json', RED);
      log('💡 Solucion: Corre "npm install" para generarlo', YELLOW);
      return false;
    }
    
    // Try npm ci to verify lock file is in sync
    execSync('npm ci --dry-run', { stdio: 'pipe' });
    log('✅ package-lock.json sincronizado', GREEN);
    return true;
  } catch (error) {
    log('❌ package-lock.json desincronizado con package.json', RED);
    log('💡 Solucion:', YELLOW);
    log('   1. rm -rf node_modules package-lock.json', YELLOW);
    log('   2. npm install', YELLOW);
    log('   3. git add package-lock.json', YELLOW);
    log('   4. git commit -m "fix: regenerate lock file"', YELLOW);
    log('   5. git push origin main', YELLOW);
    log('\n⚠️  NO uses --legacy-peer-deps, puede corromper el lock file', YELLOW);
    return false;
  }
}

function runBuild() {
  log('\n🔨 Corriendo build local...', YELLOW);
  
  try {
    execSync('npm run build', { stdio: 'inherit' });
    log('✅ Build exitoso', GREEN);
    return true;
  } catch (error) {
    log('❌ Build fallido', RED);
    return false;
  }
}

function gitPush() {
  log('\n🚀 Preparando push a GitHub...', YELLOW);
  
  try {
    // Check if there are changes to commit
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    
    if (!status.trim()) {
      log('⚠️  No hay cambios para commitear', YELLOW);
      return false;
    }
    
    execSync('git add .', { stdio: 'ignore' });
    execSync('git commit -m "deploy: actualizacion para Railway"', { stdio: 'inherit' });
    execSync('git push origin main', { stdio: 'inherit' });
    
    log('✅ Push exitoso a main', GREEN);
    log('\n🌐 Railway deberia estar deployando automaticamente...', GREEN);
    return true;
  } catch (error) {
    log('❌ Error en git push', RED);
    return false;
  }
}

// Main
log('🚂 Railway Deploy Validator', YELLOW);
log('===========================', YELLOW);

const depsOk = checkDependencies();
if (!depsOk) {
  process.exit(1);
}

const lockOk = checkLockFile();
if (!lockOk) {
  process.exit(1);
}

const buildOk = runBuild();
if (!buildOk) {
  process.exit(1);
}

const pushed = gitPush();
if (!pushed) {
  process.exit(1);
}

log('\n🎉 Deploy iniciado exitosamente!', GREEN);
log('   Revisa el dashboard de Railway para ver el estado del deploy.', GREEN);
