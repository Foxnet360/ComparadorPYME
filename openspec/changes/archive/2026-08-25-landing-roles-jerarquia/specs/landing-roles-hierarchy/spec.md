# Spec: Landing Page & 3-Tier Organizational Hierarchy

## Requirements

### Requirement 1: Public Registration for Ally Administrators
`components/AuthModal.tsx` MUST:
- Render a dedicated registration form for new Ally Companies (`ally_admin`).
- Require fields: `companyName`, `nit`, `name`, `email`, `phone`, `password`.
- Create new user with `role: 'ally_admin'` and link/persist company metadata.

### Requirement 2: Landing Page Role Showcase & Feature Showcase
`components/LandingPage.tsx` MUST:
- Display the 3-tier hierarchy (Super Admin -> Admin Aliado -> Técnico Analista).
- Display the 10 insurance domains with Colombian legal framework badges (Arts. 1083-1112 C.Co, etc.).
- Provide clear CTAs for "Registrar mi Compañía" (`onRegisterClick`) and "Iniciar Sesión" (`onLoginClick`).

### Requirement 3: Multi-tenant Role Enforcement
`App.tsx` and `components/UserManagement.tsx` MUST:
- Restrict `ally_admin` to managing their own company's technical analysts (`ally_technical`).
- Restrict `ally_technical` to running comparisons and viewing their company's risk reports.
- Grant `super_admin` platform-wide administrative controls.
