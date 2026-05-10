# Skill: railway-deploy

## Descripcion

Skill para realizar deploys seguros a Railway. Valida el proyecto localmente antes de pushear, detectando errores comunes que causan fallos en Railway.

## Flujo de Trabajo

```
┌─────────────────────────────────────────────────────────────┐
│                    DEPLOY A RAILWAY                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. VALIDAR DEPENDENCIAS                                    │
│     └─▶ Verificar que server/package.json deps esten        │
│         tambien en package.json raiz                        │
│     └─▶ Detectar dependencias faltantes                     │
│                                                             │
│  2. BUILD LOCAL                                             │
│     └─▶ npm run build (frontend + backend)                  │
│     └─▶ Detectar errores TypeScript antes del push          │
│                                                             │
│  3. COMMIT Y PUSH                                           │
│     └─▶ git add .                                           │
│     └─▶ git commit -m "deploy: <descripcion>"               │
│     └─▶ git push origin main                                │
│                                                             │
│  4. MONITOREAR (opcional)                                   │
│     └─▶ Railway deploya automaticamente desde main          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Uso

Ejecuta este skill cuando quieras deployar a Railway:

1. El skill verificara automaticamente las dependencias
2. Correra el build localmente
3. Si hay errores, los mostrara y NO hara push
4. Si todo esta bien, hara commit y push a main

## Validaciones Automaticas

### Dependencias de Sub-proyectos
- Lee `server/package.json` y compara con `package.json` raiz
- Si faltan dependencias en la raiz, advierte antes del push
- El Dockerfile solo instala desde package.json raiz

### Build Local
- Corre `npm run build` completo (frontend + backend)
- Detecta errores TypeScript antes de pushear
- Evita deploys fallidos por errores de compilacion

### Errores Comunes Detectados
- Modulos no encontrados (faltan en package.json raiz)
- Errores de tipo 'unknown' en catch blocks
- Errores de TypeScript en backend (cd server && tsc)

## Comandos

```bash
# Validar dependencias manualmente
node -e "const fs=require('fs'); const root=JSON.parse(fs.readFileSync('package.json')); const server=JSON.parse(fs.readFileSync('server/package.json')); const missing=Object.keys(server.dependencies).filter(d=>!root.dependencies[d]); if(missing.length) console.log('Faltan en raiz:', missing); else console.log('OK: Todas las dependencias estan sincronizadas');"

# Build local completo
npm run build

# Solo backend (donde suelen fallar los errores TS)
npm run build:backend
```

## Notas

- Railway deploya automaticamente desde la rama main
- El Dockerfile debe instalar dependencias desde package.json raiz
- Si agregas dependencias en server/package.json, agregalas tambien en la raiz
- Siempre correr build local antes de push para detectar errores temprano
