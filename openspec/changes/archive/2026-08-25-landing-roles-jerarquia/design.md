# Design: Landing Page & 3-Tier Organizational Hierarchy

## Architecture Diagram

```
                             ┌──────────────────────────────────────┐
                             │       SUPER ADMIN (Plataforma)       │
                             │  - Gestión Global de Intermediarios  │
                             │  - Analítica Consolidada de Ramos    │
                             └──────────────────┬───────────────────┘
                                                │
                                                ▼
                             ┌──────────────────────────────────────┐
                             │      ADMIN ALIADO (Intermediario)    │
                             │  - Registro en Landing Page (NIT)    │
                             │  - Gestión de su Equipo Técnico      │
                             └──────────────────┬───────────────────┘
                                                │
                                                ▼
                             ┌──────────────────────────────────────┐
                             │      TÉCNICOS ANALISTAS (N Usuarios) │
                             │  - Carga y Comparación de Pólizas    │
                             │  - Análisis de Riesgo Multimodal     │
                             └──────────────────────────────────────┘
```

## Key Design Decisions

1. **Self-Service Ally Admin Registration:**
   - Registration CTA on the Landing Page opens `AuthModal` in `register` mode.
   - Form fields for `ally_admin`: Company/Brokerage Name, NIT, Admin Name, Email, Phone, Password.
   - Upon registration, creates `User` with `role: 'ally_admin'` and creates/links `Ally` record with `nit` and `companyName`.

2. **Landing Page Modernization (`components/LandingPage.tsx`):**
   - **Hero Section:** Clear value proposition ("Plataforma de Inteligencia Artificial para Corredores e Intermediarios de Seguros en Colombia").
   - **Hierarchy Section:** Visual diagram/cards highlighting the 3 roles (Super Admin, Admin de Compañía, Técnico Analista).
   - **10 Domain Grid:** Displays PYME, Copropiedades, Autos, Cumplimiento, Transporte, Salud, Vida Grupo, Equipo y Maquinaria, Casco Embarcación, RCE.
   - **CTA Buttons:** "Registrar mi Compañía" (Opens `AuthModal` register) and "Iniciar Sesión" (Opens `AuthModal` login).

3. **RBAC & User Management (`components/UserManagement.tsx`):**
   - When logged in as `ally_admin`: Shows company technical analysts management, creation modal for new `ally_technical` users, and team performance metrics.
   - When logged in as `super_admin`: Shows global ally management and platform-wide user list.
