---
name: auditor-pruebas
description: "Trigger: auditor pruebas, audited tests, auditoria modulos, test audit, plan de mejoras, audit testing. Execute audited test suites across frontend and backend modules, diagnose failures and architectural bottlenecks, and synthesize an actionable improvement plan."
license: Apache-2.0
metadata:
  author: "foxnet360"
  version: "1.0"
---

## Activation Contract

Activate this skill when:
- Executing an audited test campaign across the system or specific modules.
- Auditing code health, test reliability, or regression points across frontend, backend, or LLM pipelines.
- Formulating an evidence-based technical Improvement Plan based on module-by-module diagnostics.

Do not activate for trivial single-line edits or standalone bugfixes that do not require module auditing.

## Hard Rules

- **Evidence First**: Never declare a test or module healthy without running verification commands (`npm run typecheck:*`, `npm run test:*`, `npm run lint`).
- **Preserve Boundaries**: Distinguish unit failures, contract mismatches, and infrastructure/runtime gaps (e.g., Supabase/Redis credentials).
- **Audit Completeness**: Inspect code quality, error handling, edge cases, and architectural compliance (Clean Architecture, SOLID, loose coupling), not just green checkmarks.
- **Root Cause Rigor**: Every issue flagged must include the file path, line reference, exact symptom, and fundamental root cause.
- **Actionable Planning**: Improvement plans must prioritize by Impact vs. Effort (P0 Critical, P1 High, P2 Medium) with concrete acceptance criteria.

## Decision Gates

| Scope / Goal | Action | Primary Commands / Checks |
| :--- | :--- | :--- |
| **Full System Audit** | Run full verification suite across all layers | `typecheck:backend`, `typecheck:frontend`, `test:unit`, `test:integration`, `lint` |
| **Core LLM / Extraction Audit** | Audit extraction pipelines, schemas, and golden sets | `server/src/services/*Extractor*`, `server/src/evaluation/*`, `evaluate:golden` |
| **Comparison & Ontology Audit** | Verify coverage matching, ontology mapping, deductibles | `server/src/services/coverage*`, `deductibleParser*`, unit tests |
| **Frontend & UI Audit** | Component rendering, state, virtualization, responsiveness | `npm run test:unit:frontend`, React best practices review |
| **Backend API & Data Audit** | Routes, controllers, repositories, rate limits, Supabase | `npm run test:unit:backend`, schema validation |

## Execution Steps

1. **Module & Suite Discovery**
   - Identify targeted modules: Extraction/LLM, Ontology, Deductibles, Comparison Matrix, RAG/Chat, UI Components, Repositories/Database.
   - Inspect corresponding test suites in `tests/` and `server/src/__tests__/`.

2. **Run Test Suites with Audit Logging**
   - Execute baseline typechecking:
     ```bash
     npm run typecheck:backend && npm run typecheck:frontend
     ```
   - Execute backend and frontend test runners:
     ```bash
     npm run test:unit
     npm run test:integration
     ```
   - Capture failure outputs, stack traces, and slow-running tests.

3. **In-Depth Module Quality & Edge Case Inspection**
   - Review exception handling: are errors caught and sanitized or leaked?
   - Review typing: verify strict types, absence of unsafe `any` casts.
   - Review state and reactivity: check for unnecessary re-renders, memory leaks, unhandled async states.
   - Review contracts: verify payload validation (Ajv, schemas) between frontend and backend.

4. **Synthesize Module Audit Receipts**
   - Record test status: PASS, FAIL, DEGRADED, or UNCOVERED.
   - Document specific architectural anti-patterns or technical debt identified.

5. **Generate the Actionable Improvement Plan**
   - Group findings by module and layer.
   - Assign severity (P0 Blocker, P1 High Value, P2 Polish/Refactor).
   - Formulate concrete refactoring tasks with expected outcomes.

## Output Contract

The agent produces a structured markdown audit report formatted as:
1. **Executive Summary**: High-level test score, coverage status, and critical blockers.
2. **Audit Matrix by Module**: Table detailing Module, Tested Capabilities, Status, and Findings.
3. **Deep-Dive Findings**: Technical breakdown per issue (File, Symptom, Root Cause, Evidence).
4. **Actionable Improvement Plan**: Roadmap partitioned into:
   - Phase 1: Immediate Stabilization (P0)
   - Phase 2: Architecture & Reliability Enhancements (P1)
   - Phase 3: Performance, Polish & Extensibility (P2)
