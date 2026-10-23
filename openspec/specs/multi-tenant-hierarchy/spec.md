# Capability: Jerarquía Multi-Tenant y RLS a Nivel de Equipo

## Purpose
Establecer un modelo jerárquico multi-inquilino (multi-tenant) seguro y colaborativo donde las organizaciones de corretaje de seguros y sus miembros (administradores y analistas técnicos) comparten carteras, clientes, pólizas y métricas analíticas bajo aislamiento estricto garantizado por Row Level Security (RLS) en Supabase y autorización en Express.

## Requirements

### Requirement 1: Modelo de Organizaciones y Membresías
The system MUST store distinct brokerage organizations in `public.organizations` and maintain user memberships with roles in `public.organization_members`.

#### Scenario 1.1: Registro de un nuevo aliado comercial
- **Given** an unauthenticated visitor registering as an Ally Administrator
- **When** the registration form is submitted with valid company name and NIT
- **Then** the system MUST insert a record into `public.organizations` and create a membership in `public.organization_members` with role `ally_admin`.

#### Scenario 1.2: Invitación de un analista técnico a una organización existente
- **Given** an authenticated user with role `ally_admin` in Organization A
- **When** they add a new analyst with email and name
- **Then** the system MUST register the user and bind them to Organization A in `public.organization_members` with role `ally_technical`.

---

### Requirement 2: Aislamiento y Visibilidad Colaborativa RLS (XC-1)
The system MUST allow users to view and modify portfolio records if they own the record directly OR belong to the same organization as the record's `org_id`.

#### Scenario 2.1: Colaboración entre analistas de la misma organización
- **Given** Analyst 1 and Analyst 2 both belong to Organization A
- **When** Analyst 1 creates a client and policy with `org_id = Organization A`
- **Then** Analyst 2 MUST be able to query and view that client and policy.

#### Scenario 2.2: Aislamiento estricto entre organizaciones distintas
- **Given** Analyst 1 belongs to Organization A and Analyst 3 belongs to Organization B
- **When** Analyst 3 queries `/api/clients` or runs a SELECT query on `public.clients`
- **Then** the system MUST NOT return any client owned by or assigned to Organization A.

#### Scenario 2.3: Supervisión por parte del Administrador de Aliado
- **Given** Ally Admin belongs to Organization A
- **When** Ally Admin views executive analytics or list of team renewals
- **Then** the system MUST aggregate all policies and renewals where `org_id = Organization A`.

#### Scenario 2.4: Visibilidad de Super Admin
- **Given** an authenticated user with role `super_admin`
- **When** requesting cross-organization telemetry or platform benchmarks
- **Then** the system MUST allow global read access across all organizations.

---

### Requirement 3: Enriquecimiento de Contexto de Autenticación
The Express backend MUST extract `org_id` and `role` during authentication and reject spoofing attempts.

#### Scenario 3.1: Intento de forjar `org_id` desde el cliente
- **Given** an authenticated request containing a spoofed `orgId` or `userId` in the HTTP request body
- **When** the endpoint processes the request
- **Then** the system MUST reject the request with HTTP 400 Bad Request or overwrite it with the session's verified `org_id`.
