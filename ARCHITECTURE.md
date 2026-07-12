# QuickVerdicts — Technical Architecture

> Microservices migration using the **Strangler Fig** pattern.  
> The monolith remains live and unchanged; services are extracted one at a time.

---

## System Overview

```
Client (Browser / Mobile)
        │
        ▼
  API Gateway :5000
        │
  ┌─────┼─────────────────────────────────┐
  │     │                                 │
  ▼     ▼     ▼        ▼         ▼        ▼ (legacy, progressively drained)
auth  notif  payment  case     trial    monolith
:5001 :5002  :5003    :5004    :5005     :4000
                                │
              ┌─────────────────┼────────────────┐
              ▼                 ▼                ▼
        Azure SQL         Azure Blob         Azure ACS
         Server            Storage           Rooms
```

---

## Services

### Extracted (live)

| Service | Port | Description |
|---------|------|-------------|
| `auth-service` | 5001 | Register · Login · JWT · Password reset · Email verification |
| `notification-service` | 5002 | In-app notifications · Mark read/unread · Internal POST endpoint |
| `payment-service` | 5003 | Stripe payments · Subscriptions · Coupons · Webhook processing |
| `case-service` | 5004 | Cases CRUD · Documents (SAS URLs) · Witnesses · Tier upgrades · Job board |
| `trial-service` | 5005 | ACS video rooms · Socket.IO real-time · Trial scheduling · Recordings |

### Planned (still in monolith)

| Service | Port | Description |
|---------|------|-------------|
| `war-room-service` | 5006 | Collaboration workspace · Evidence board · File sharing · Chat |
| `verdict-service` | 5007 | Verdict submission · Jury charge questions · Juror payment triggers |
| `attorney-service` | 5008 | Attorney profiles · Verification · Calendar · Reschedule requests |
| `juror-service` | 5009 | Juror profiles · Voir dire · Availability · Payment history |
| `admin-service` | 5010 | Platform administration · User management · Analytics · Config |
| `monolith (backend)` | 4000 | Original Express app — routes progressively removed as services are extracted |

---

## Communication Patterns

### REST HTTP (synchronous)
- Client → API Gateway → target service (JSON, JWT in `Authorization` header or cookie)
- Services call `POST /internal/notifications` on `notification-service` for notification creation
- Internal calls use `X-Internal-Token` header (separate from JWT) to prevent public access

### WebSocket (real-time)
- `trial-service` runs a **Socket.IO** server for jury charge and verdict events
- `war-room-service` (planned) runs its own Socket.IO server for collaboration
- JWT is validated on the Socket.IO `connection` handshake

### Shared Database
- All services connect to the **same Azure SQL Server instance**
- Each service owns its domain models — no cross-service joins at the application layer
- Future migration path: split into per-service schemas when traffic demands isolation

---

## Infrastructure

| Component | Purpose | Notes |
|-----------|---------|-------|
| **Azure App Service** | Hosts each microservice | One App Service per service; independent deploy & scale |
| **Azure SQL Server** | Shared relational database | Single DB; all services use `mssql` + `tedious` driver |
| **Azure Blob Storage** | Documents, recordings, evidence | Container: `warroom-documents`; SAS URLs for time-limited access |
| **Azure Communication Services** | Video rooms + identity tokens | ACS Rooms + ACS Identity; used by `trial-service` |
| **Stripe** | Payments + payouts | Used by `payment-service` (subscriptions) and `case-service` (tier upgrades) |
| **SMTP / Nodemailer** | Transactional email | Used by `auth-service` and `trial-service` |

---

## Security

### Authentication
- **JWT** — all services share the same `JWT_SECRET` environment variable
- Tokens are verified by each service independently (no central auth call on every request)
- Cookies (`httpOnly`, `sameSite`) used for browser clients; `Authorization: Bearer` for API clients

### Internal Service-to-Service
- `notification-service` internal endpoint secured by `X-Internal-Token` header
- Token set via `INTERNAL_SERVICE_TOKEN` env var (must match across all calling services)
- Never exposed through the API gateway

### External Integrations
- Stripe webhook signature verified using raw request body + `STRIPE_WEBHOOK_SECRET`
- Azure Blob SAS URLs are short-lived (60 min read, 120 min write) and scoped to a single blob
- ACS identity tokens scoped per-user per-room

---

## Design Principles

### Strangler Fig
The monolith is never modified. Each extracted service handles its domain end-to-end. The gateway routes traffic progressively away from the monolith as services go live.

### Graceful Degradation
Optional integrations (Azure Blob, ACS, Stripe) log a warning and allow the service to start without them. Endpoints that require the missing integration return `503` with a clear message.

### Independent Deployment
Each service has its own `package.json`, `.env.example`, and `index.js`. Services can be deployed, scaled, restarted, and versioned independently.

### No Shared Code Packages (yet)
Common files (`config/db.js`, `middleware/authMiddleware.js`) are copied into each service. This keeps services self-contained and avoids a shared-library dependency during early migration. A shared internal package can be introduced once the service boundaries are stable.

---

## Port Allocation

```
5000  API Gateway
5001  auth-service
5002  notification-service
5003  payment-service
5004  case-service
5005  trial-service
5006  war-room-service     (planned)
5007  verdict-service      (planned)
5008  attorney-service     (planned)
5009  juror-service        (planned)
5010  admin-service        (planned)
4000  monolith (legacy)
```

---

## Environment Variables (common to all services)

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_SERVER` | Yes | Azure SQL Server hostname |
| `DB_NAME` | Yes | Database name |
| `DB_USER` | Yes | Database username |
| `DB_PASSWORD` | Yes | Database password |
| `JWT_SECRET` | Yes | Must be identical across all services (min 32 chars) |
| `FRONTEND_URL` | Yes | Allowed CORS origin for the frontend |
| `GATEWAY_URL` | No | Allowed CORS origin for the gateway |
| `ALLOWED_ORIGINS` | No | Comma-separated list of additional allowed origins |
| `PORT` | No | Defaults to service-specific port (see above) |
| `RATE_LIMIT_MAX` | No | Requests per 15-min window (default: 300) |

See each service's `.env.example` for service-specific variables.
