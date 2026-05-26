## ADDED Requirements

### Requirement: Health check endpoint reports dependency status
The system SHALL extend the existing `GET /health` endpoint to report the real-time status of all critical dependencies.

#### Scenario: All services healthy
- **WHEN** a client sends a GET request to `/health`
- **AND** Gemini API, Supabase, and Redis (if configured) are all accessible
- **THEN** the response SHALL have HTTP status 200
- **AND** the response body SHALL contain `status: "healthy"`
- **AND** it SHALL include latency metrics for each service

#### Scenario: Gemini service unavailable
- **WHEN** a client sends a GET request to `/health`
- **AND** the Gemini API is not responding
- **THEN** the response SHALL have HTTP status 503
- **AND** the response body SHALL contain `status: "degraded"`
- **AND** it SHALL indicate that Gemini is unavailable

#### Scenario: Supabase connection failed
- **WHEN** a client sends a GET request to `/health`
- **AND** the Supabase database connection fails
- **THEN** the response SHALL have HTTP status 503
- **AND** the response body SHALL contain `status: "degraded"`
- **AND** it SHALL indicate that Supabase is unavailable

#### Scenario: Redis not configured
- **WHEN** a client sends a GET request to `/health`
- **AND** the Redis URL is not configured
- **THEN** the response SHALL NOT include Redis in the services list
- **AND** the overall status SHALL still be determined by other services

### Requirement: Health check response format
The system SHALL return health status in a standardized JSON format.

#### Scenario: Standard health response structure
- **WHEN** the `/health` endpoint is called
- **THEN** the response SHALL follow this structure:
```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "gemini": { "status": "ok", "latency": 120 },
    "supabase": { "status": "ok", "latency": 45 },
    "redis": { "status": "ok", "latency": 5 }
  }
}
```

### Requirement: Cached health checks
The system SHALL cache health check results to avoid excessive external API calls.

#### Scenario: Rapid health check requests
- **WHEN** multiple health check requests arrive within 30 seconds
- **THEN** only the first request SHALL trigger actual dependency checks
- **AND** subsequent requests SHALL return cached results
- **AND** the cache SHALL expire after 30 seconds
