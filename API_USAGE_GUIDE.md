# API Client Usage Guide

## Quick Start

### Import the API Client
```typescript
import { api } from '../lib/api';
```

### Save Circle Metadata
```typescript
await api.saveCircleMetadata(
  contractAddress,
  'Circle Name',
  'Description of the circle'
);
```

### Generate Invite Code
```typescript
const inviteResponse = await api.generateInviteCode(
  contractAddress,
  720 // 30 days in hours
);
const shortCode = inviteResponse.shortCode;
```

### Track User Circle
```typescript
await api.trackCircle(walletAddress, contractAddress);
```

### Record Invite Join
```typescript
await api.recordInviteJoin(shortCode, walletAddress);
```

### Save User Preferences
```typescript
await api.saveUserPreferences(
  walletAddress,
  'user@example.com',
  true, // enable push notifications
  'America/New_York' // timezone
);
```

## Error Handling

All API calls are wrapped in try-catch blocks in the page components. The standard pattern:

```typescript
try {
  await api.saveCircleMetadata(address, name, description);
} catch (apiErr) {
  console.error('Failed to save metadata:', apiErr);
  // Continue even if API fails - blockchain data is primary
}
```

## Environment Setup

1. **Development**: 
   - Backend runs on `http://localhost:5000`
   - Set in `frontend/.env.local`

2. **Production**:
   - Update `VITE_API_BASE_URL` to production backend URL
   - Example: `VITE_API_BASE_URL=https://api.trustcircle.com`

## Implementation Details

### Request Format
All API requests follow a standard format:

**Request**:
```json
{
  "method": "POST",
  "headers": { "Content-Type": "application/json" },
  "body": { /* request data */ }
}
```

**Response**:
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Success message"
}
```

### Response Validation
The API client automatically:
- Validates HTTP status codes (throws on 4xx/5xx)
- Parses JSON responses
- Checks `success` field
- Returns `data` field to caller

## Where API Is Used

| Page | Method | Purpose |
|------|--------|---------|
| CreateCircle.tsx | `saveCircleMetadata()` | Save new circle to database |
| CreateCircle.tsx | `generateInviteCode()` | Create shareable invite link |
| JoinCircle.tsx | `recordInviteJoin()` | Log user join event |
| JoinCircle.tsx | `trackCircle()` | Associate user with circle |
| Dashboard.tsx | `saveCircleMetadata()` | Sync loaded circles data |
| CircleDetail.tsx | `saveCircleMetadata()` | Track circle details |

## Offline Behavior

The application continues to function without the backend:
- All on-chain blockchain operations work normally
- API calls fail silently with console logging
- No user-blocking errors are shown
- Blockchain data is the source of truth

## Future Extensions

To add new API endpoints:

```typescript
async newFeature(param1: string, param2: number) {
  return this.request<ResponseType>(
    'POST',
    '/api/endpoint',
    { param1, param2 }
  );
}
```

Then use in components:
```typescript
await api.newFeature(value1, value2);
```

## Debugging

1. **Check Console**: API calls logged with `console.error()` on failures
2. **Network Tab**: View actual HTTP requests/responses in browser DevTools
3. **Backend Logs**: Check backend server logs for request details
4. **Environment**: Verify `VITE_API_BASE_URL` is correctly set in `.env.local`
