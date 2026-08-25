# Spec: Analítica Ejecutiva y Control de Acceso RBAC

## Requirement: Jerarquía de Roles Multi-Tenant
The system MUST support three distinct roles: `super_admin`, `ally_admin`, and `ally_technical`.

### Scenario: Filtering data by Ally Admin
- **GIVEN** a user with role `ally_admin` assigned to `ally_id = "ally-100"`
- **WHEN** fetching analytics or history
- **THEN** the system MUST return records exclusively associated with `ally_id = "ally-100"`
- **AND** it MUST NOT expose data from other allies.

### Scenario: Self-service view for Technical Analyst
- **GIVEN** a user with role `ally_technical`
- **WHEN** opening the Executive Analytics dashboard
- **THEN** it MUST display personal KPIs (personal volume, personal conversion, personal time per comparison)
- **AND** it MUST NOT expose team management or cross-analyst ranking.

### Scenario: Super Admin Global Access
- **GIVEN** a user with role `super_admin`
- **WHEN** viewing Executive Analytics
- **THEN** it MUST display global multi-ally KPIs, AI accuracy benchmarks, and ally performance rankings.
