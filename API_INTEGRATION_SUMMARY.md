# API Client Integration Summary

## Overview
A comprehensive API client has been integrated across the TrustCircle frontend application to enable communication with the backend service for metadata storage, invite management, and user preference tracking.

## API Client Implementation

### File: `/frontend/src/lib/api.ts`
A TypeScript API client class that provides:

- **Base Configuration**: Uses environment variable `VITE_API_BASE_URL` (defaults to `http://localhost:5000`)
- **Request Method**: Generic private `request<T>()` method with:
  - Automatic JSON serialization/deserialization
  - Error handling and logging
  - HTTP status validation
  - Response format validation

### Available API Methods

1. **saveCircleMetadata(contractAddress, name, description)**
   - POST `/api/circles/metadata`
   - Saves circle creation details to backend database

2. **getCircleMetadata(contractAddress)**
   - GET `/api/circles/{contractAddress}`
   - Retrieves saved circle metadata

3. **generateInviteCode(contractAddress, expiresIn)**
   - POST `/api/invites`
   - Creates shareable invite codes with configurable expiration
   - Default: 720 hours (30 days)

4. **resolveInviteCode(shortCode)**
   - GET `/api/invites/{shortCode}`
   - Resolves invite code to circle details

5. **recordInviteJoin(shortCode, walletAddress)**
   - POST `/api/invites/{shortCode}/joined`
   - Logs user join event for analytics

6. **saveUserPreferences(walletAddress, email, enablePushNotifications, timezoneName)**
   - POST `/api/users/preferences`
   - Stores user notification and timezone preferences

7. **trackCircle(walletAddress, contractAddress)**
   - POST `/api/users/track-circle`
   - Associates user wallet with circles for dashboard tracking

## Page Integration

### 1. **CreateCircle.tsx** (`/pages/CreateCircle.tsx`)
Integration Points:
- After successful contract deployment, saves circle metadata to backend
- Generates invite code for easy sharing
- Captures circle on-chain address and stores in database
- Fallback handling if API calls fail (still shows basic invite link)

### 2. **JoinCircle.tsx** (`/pages/JoinCircle.tsx`)
Integration Points:
- Records user join via `recordInviteJoin()` after contract join
- Tracks circle association with user wallet via `trackCircle()`
- Enables dashboard to display user's circles
- Graceful error handling - doesn't block successful joins if API fails

### 3. **Dashboard.tsx** (`/pages/Dashboard.tsx`)
Integration Points:
- Syncs each loaded circle's metadata to backend via `saveCircleMetadata()`
- Enables future backend-based filtering and search
- Caches metadata for analytics and user preferences
- Continues loading even if API calls fail (on-chain data takes priority)

### 4. **CircleDetail.tsx** (`/pages/CircleDetail.tsx`)
Integration Points:
- Saves circle metadata when loading details
- Prepares for future contribution analytics
- Tracks detailed circle information for backend analytics

## Environment Configuration

### File: `/frontend/.env.local`
```
VITE_API_BASE_URL=http://localhost:5000
```

For production deployment, update to:
```
VITE_API_BASE_URL=https://api.trustcircle.com
```

## Error Handling Strategy

All API integrations follow a **graceful degradation** pattern:
- **Critical path**: Blockchain operations (on-chain data fetching) always completed
- **Optional path**: API calls wrapped in try-catch and logged, but don't block UX
- **User feedback**: Error logging to console for debugging, no blocking UI errors
- **Resilience**: Application continues to work with on-chain data if backend is unavailable

## Architecture Benefits

1. **Separation of Concerns**: API logic isolated in dedicated client module
2. **Reusability**: Single API client instance used across all pages
3. **Type Safety**: Generic `request<T>` method ensures proper typing
4. **Maintainability**: Centralized API endpoint management
5. **Extensibility**: Easy to add new API methods without modifying page components
6. **Fallback**: Works offline/without backend - users can still interact with blockchain

## Testing the Integration

1. **Local Backend Required**: Start backend on port 5000
   ```bash
   cd backend
   npm start
   ```

2. **Frontend with API**: Start frontend (API client will attempt connections)
   ```bash
   cd frontend
   npm run dev
   ```

3. **Verify Calls**: Check browser console for API call logs and responses

4. **Offline Mode**: Works without backend (on-chain operations continue)

## Future Enhancements

- Add request retry logic with exponential backoff
- Implement API call caching to reduce duplicate requests
- Add TypeScript interfaces for API request/response types
- Implement WebSocket events for real-time updates
- Add API authentication tokens for user-specific data
- Implement analytics dashboard backed by API data
