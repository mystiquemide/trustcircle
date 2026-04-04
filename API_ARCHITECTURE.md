# API Integration Architecture

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   TrustCircle Frontend (React)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐    ┌──────────────────┐                  │
│  │  CreateCircle    │    │   JoinCircle     │                  │
│  └──────────────────┘    └──────────────────┘                  │
│           │                        │                             │
│  ┌────────┴─────────────┬─────────┴──────────┐                 │
│  │                      │                      │                 │
│  ▼                      ▼                      ▼                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                  API Client Module                           │ │
│ │  (src/lib/api.ts)                                            │ │
│ │                                                               │ │
│ │  • saveCircleMetadata()                                      │ │
│ │  • generateInviteCode()                                      │ │
│ │  • recordInviteJoin()                                        │ │
│ │  • trackCircle()                                             │ │
│ │  • saveUserPreferences()                                     │ │
│ │  • resolveInviteCode()                                       │ │
│ │                                                               │ │
│ │  Base URL: import.meta.env.VITE_API_BASE_URL                │ │
│ └─────────────────────────────────────────────────────────────┘ │
│           │                    │                    │             │
│           │ POST/GET          │ POST              │ POST        │
│           ▼                    ▼                    ▼             │
│  ┌──────────────────┐   ┌──────────────────┐  ┌──────────────┐ │
│  │  Dashboard       │   │  CircleDetail    │  │  Blockchain  │ │
│  │                  │   │                  │  │  (Viem)      │ │
│  └──────────────────┘   └──────────────────┘  └──────────────┘ │
│           │                        │                    │        │
└───────────┼────────────────────────┼────────────────────┼────────┘
            │                        │                    │
            │ HTTP Request          │ HTTP Request       │ Web3
            │ (JSON)                │ (JSON)             │ Calls
            ▼                        ▼                    ▼
    ┌───────────────────────────────────────────────────────────┐
    │           Backend API Server (Node.js/Express)             │
    ├───────────────────────────────────────────────────────────┤
    │  Port: 5000                                               │
    │                                                            │
    │  Endpoints:                                               │
    │  • POST   /api/circles/metadata      → Store metadata     │
    │  • GET    /api/circles/{address}     → Fetch metadata     │
    │  • POST   /api/invites               → Generate code      │
    │  • GET    /api/invites/{code}        → Resolve code       │
    │  • POST   /api/invites/{code}/joined → Log join event     │
    │  • POST   /api/users/preferences     → Store preferences  │
    │  • POST   /api/users/track-circle    → Track circles      │
    └───────────────────────────────────────────────────────────┘
            │
            │ Database Operations
            ▼
    ┌───────────────────────────────────────────────────────────┐
    │                Database (MongoDB/PostgreSQL)               │
    ├───────────────────────────────────────────────────────────┤
    │  Collections/Tables:                                      │
    │  • circles (metadata, contract addresses)                 │
    │  • invites (codes, expiration, usage tracking)            │
    │  • users (preferences, tracked circles, emails)           │
    │  • events (join events, contribution tracking)            │
    └───────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Circle Creation Flow
```
User fills form
    ↓
CreateCircle component
    ↓
Deploy contract via Viem
    ↓
Contract deployment successful
    ↓
api.saveCircleMetadata()  ← API Call
    ↓
api.generateInviteCode()  ← API Call
    ↓
Display invite link
```

### 2. Circle Join Flow
```
User clicks invite link
    ↓
JoinCircle component loads
    ↓
Join circle contract via Viem
    ↓
Contract join successful
    ↓
api.recordInviteJoin()  ← API Call
api.trackCircle()       ← API Call
    ↓
Redirect to dashboard
```

### 3. Dashboard Load Flow
```
User navigates to dashboard
    ↓
Dashboard component loads
    ↓
Fetch all circles via smart contract (Viem)
    ↓
For each circle:
    ├─ api.saveCircleMetadata()  ← API Call (sync)
    └─ Continue loading
    ↓
Display all user circles
```

## Integration Points

### Page → API Client Mapping

```typescript
// CreateCircle.tsx
await api.saveCircleMetadata(circleAddress, name, description);
await api.generateInviteCode(circleAddress, 720);

// JoinCircle.tsx
await api.recordInviteJoin(circleId, userAddress);
await api.trackCircle(userAddress, circleAddress);

// Dashboard.tsx
await api.saveCircleMetadata(circleAddress, name, description);

// CircleDetail.tsx
await api.saveCircleMetadata(address, name, description);
```

## Error Handling Strategy

```
API Call
    ↓
try-catch wrapper
    ↓
├─ Success → Continue (data saved or synced)
│
└─ Error → Log to console (non-blocking)
  ↓
Blockchain operation continues
  ↓
User experience unaffected
```

## Configuration

### Environment Variables
```env
# .env.local (Development)
VITE_API_BASE_URL=http://localhost:5000

# .env.production (Production)
VITE_API_BASE_URL=https://api.trustcircle.com
```

### API Response Format
```json
{
  "success": true,
  "data": {
    // Response data varies by endpoint
  },
  "message": "Optional success message"
}
```

## Key Features

1. **Automatic Error Handling**: Built-in JSON parsing and status validation
2. **Type Safety**: Generic TypeScript typing for all responses
3. **Logging**: Console logging for debugging API calls
4. **Graceful Degradation**: Works without backend (blockchain-first approach)
5. **Consistent Interface**: All methods follow same request pattern
6. **Extensible**: Easy to add new endpoints

## Security Considerations

- API client runs in browser (frontend)
- No sensitive auth tokens (future enhancement)
- Blockchain is source of truth
- Backend validates all operations
- CORS enabled for cross-origin requests (backend config)

## Performance Optimizations

- Parallel API calls where possible
- Async/await for non-blocking I/O
- No request caching (fresh data priority)
- Minimal overhead per request (~1KB)

## Testing the Integration

```bash
# 1. Start backend
cd backend && npm start
# Expected: Server on http://localhost:5000

# 2. Start frontend
cd frontend && npm run dev
# Expected: App on http://localhost:5173

# 3. Open browser console
# Expected: API calls logged when creating/joining circles

# 4. Check Network tab
# Expected: POST/GET requests to http://localhost:5000/api/*
```

## Future Enhancements

- [ ] Add request retry logic with exponential backoff
- [ ] Implement response caching
- [ ] Add TypeScript interfaces for all endpoints
- [ ] Implement WebSocket for real-time updates
- [ ] Add API authentication with tokens
- [ ] Implement analytics dashboard
- [ ] Add offline queue for API calls
- [ ] Add API rate limiting handling
