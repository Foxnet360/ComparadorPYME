## ADDED Requirements

### Requirement: Error Boundaries
The system SHALL use React Error Boundaries to prevent complete application crashes.

#### Scenario: Component error
- **WHEN** a child component throws an error
- **THEN** the Error Boundary SHALL catch it
- **AND** display a fallback UI instead of crashing the entire app
- **AND** log the error for debugging

#### Scenario: Main sections
- **WHEN** the application loads
- **THEN** at minimum, `ComparisonReport`, `AuditDashboard`, and `ChatBot` SHALL be wrapped in Error Boundaries

### Requirement: ARIA Labels
The system SHALL add ARIA labels to all interactive elements.

#### Scenario: Icon buttons
- **WHEN** a button contains only an icon (no text)
- **THEN** it SHALL have an `aria-label` attribute
- **AND** the label SHALL describe the action (e.g., "Cerrar chat", "Cerrar sesión")

#### Scenario: Form inputs
- **WHEN** a form has a label and input
- **THEN** the label SHALL have `htmlFor` matching the input's `id`
- **AND** screen readers SHALL be able to associate them

### Requirement: Keyboard Accessibility
The system SHALL support keyboard navigation.

#### Scenario: Modal focus trap
- **WHEN** a modal is opened
- **THEN** focus SHALL be trapped within the modal
- **AND** pressing Escape SHALL close the modal
- **AND** focus SHALL return to the trigger element on close

#### Scenario: Clickable divs
- **WHEN** an element is clickable
- **THEN** it SHALL be a `<button>` element (not a `<div>` with `onClick`)
- **AND** it SHALL be keyboard focusable

### Requirement: React Keys
The system SHALL use stable unique IDs instead of array indices for React keys.

#### Scenario: File list
- **WHEN** rendering a list of uploaded files
- **THEN** each item SHALL have a unique key (e.g., file name + timestamp)
- **AND** `key={idx}` SHALL NOT be used

#### Scenario: Chat messages
- **WHEN** rendering chat messages
- **THEN** each message SHALL have a unique key (e.g., message ID or timestamp)
- **AND** `key={idx}` SHALL NOT be used

### Requirement: Reduced Motion Support
The system SHALL respect user preference for reduced motion.

#### Scenario: User prefers reduced motion
- **WHEN** the user has `prefers-reduced-motion: reduce` enabled
- **THEN** animations SHALL be disabled or minimized
- **AND** transitions SHALL be instant or subtle

### Requirement: Console Cleanup
The system SHALL remove or wrap console statements for production.

#### Scenario: Production build
- **WHEN** running in production mode
- **THEN** no `console.log`, `console.error`, or `console.warn` SHALL appear in the browser console
- **AND** errors SHALL be sent to a logging service instead

---

## Delta from change: complete-system-audit-remediation

## ADDED Requirements

### Requirement: Error Boundaries
The system SHALL use React Error Boundaries to prevent complete application crashes.

#### Scenario: Component error
- **WHEN** a child component throws an error
- **THEN** the Error Boundary SHALL catch it
- **AND** display a fallback UI instead of crashing the entire app
- **AND** log the error for debugging

#### Scenario: Main sections
- **WHEN** the application loads
- **THEN** at minimum, `ComparisonReport`, `AuditDashboard`, and `ChatBot` SHALL be wrapped in Error Boundaries

### Requirement: ARIA Labels
The system SHALL add ARIA labels to all interactive elements.

#### Scenario: Icon buttons
- **WHEN** a button contains only an icon (no text)
- **THEN** it SHALL have an `aria-label` attribute
- **AND** the label SHALL describe the action (e.g., "Cerrar chat", "Cerrar sesión")

#### Scenario: Form inputs
- **WHEN** a form has a label and input
- **THEN** the label SHALL have `htmlFor` matching the input's `id`
- **AND** screen readers SHALL be able to associate them

### Requirement: Keyboard Accessibility
The system SHALL support keyboard navigation.

#### Scenario: Modal focus trap
- **WHEN** a modal is opened
- **THEN** focus SHALL be trapped within the modal
- **AND** pressing Escape SHALL close the modal
- **AND** focus SHALL return to the trigger element on close

#### Scenario: Clickable divs
- **WHEN** an element is clickable
- **THEN** it SHALL be a `<button>` element (not a `<div>` with `onClick`)
- **AND** it SHALL be keyboard focusable

### Requirement: React Keys
The system SHALL use stable unique IDs instead of array indices for React keys.

#### Scenario: File list
- **WHEN** rendering a list of uploaded files
- **THEN** each item SHALL have a unique key (e.g., file name + timestamp)
- **AND** `key={idx}` SHALL NOT be used

#### Scenario: Chat messages
- **WHEN** rendering chat messages
- **THEN** each message SHALL have a unique key (e.g., message ID or timestamp)
- **AND** `key={idx}` SHALL NOT be used

### Requirement: Reduced Motion Support
The system SHALL respect user preference for reduced motion.

#### Scenario: User prefers reduced motion
- **WHEN** the user has `prefers-reduced-motion: reduce` enabled
- **THEN** animations SHALL be disabled or minimized
- **AND** transitions SHALL be instant or subtle

### Requirement: Console Cleanup
The system SHALL remove or wrap console statements for production.

#### Scenario: Production build
- **WHEN** running in production mode
- **THEN** no `console.log`, `console.error`, or `console.warn` SHALL appear in the browser console
- **AND** errors SHALL be sent to a logging service instead
