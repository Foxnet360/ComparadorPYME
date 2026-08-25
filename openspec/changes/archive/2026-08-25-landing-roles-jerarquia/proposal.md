# Proposal: Landing Page Update & 3-Tier Hierarchy (Super Admin -> Ally Admin -> Technical Analyst)

## Intent
Update the Landing Page (`components/LandingPage.tsx`) and authentication/registration workflows to reflect updated project features and the strict 3-tier user hierarchy:
1. **Super Admin (`super_admin`):** Global application administrator, manages all Ally Companies and all Technical Analysts across the platform.
2. **Ally Admin (`ally_admin`):** One primary administrator per Ally/Intermediary company. Registers via the public Landing Page with company credentials (NIT, company name, contact info) and manages their own team of Technical Analysts.
3. **Ally Technical Analyst (`ally_technical`):** N technical analysts created and managed directly by their company's Ally Admin to run comparisons and risk evaluations.

## Scope
- Update `components/LandingPage.tsx` hero section, domain showcase (10 insurance domains), role hierarchy breakdown, and registration call to action.
- Update registration modal / flow (`components/AuthModal.tsx` / `App.tsx`) to register Ally Administrators (`ally_admin`) with company metadata (NIT, Company Name, Admin Name, Email, Password, Phone).
- Ensure proper routing and RBAC enforcement based on `UserRole` (`super_admin` | `ally_admin` | `ally_technical`).

## Impact
- Clear self-service onboarding for new Broker/Intermediary Companies.
- Coherent, non-ambiguous multi-tenant hierarchy across User Management, Analytics, and Comparison dashboards.
