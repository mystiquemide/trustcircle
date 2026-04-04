# TrustCircle Backend

Minimal Node.js + Firebase backend for TrustCircle. Handles circle metadata, invite links, and notification scheduling.

## Project Structure

```
backend/
├── src/
│   ├── server.js                 # Express server + Firebase initialization
│   └── routes/
│       ├── circles.js            # Circle metadata CRUD endpoints
│       ├── invites.js            # Invite code generation & resolution
│       └── users.js              # User preferences & device registration
├── functions/
│   └── index.js                  # Firebase Cloud Functions (scheduled + HTTP)
├── firestore.rules               # Firestore security rules
├── firebase.json                 # Firebase configuration
├── .env.example                  # Environment variables template
├── .gitignore
├── package.json
└── README.md                     # This file
```

## Setup Instructions

### 1. Install Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

### 2. Create Firebase Project
```bash
firebase init
# Select: Firestore, Cloud Functions, Hosting
# Select your-trustcircle-project
# Use existing project or create new
# Configure firestore.rules, functions, public
```

### 3. Install Dependencies
```bash
npm install
cd functions && npm install
```

### 4. Configure Environment Variables
```bash
cp .env.example .env
```

Update `.env` with your Firebase service account credentials:
- Get from: Firebase Console → Project Settings → Service Accounts → Generate New Private Key
- Download JSON and copy values to `.env`

### 5. Deploy to Firebase

**Deploy Cloud Functions:**
```bash
firebase deploy --only functions
```

**Deploy Firestore Rules:**
```bash
firebase deploy --only firestore:rules
```

**Deploy Everything:**
```bash
firebase deploy
```

### 6. Run Locally
```bash
npm install -g firebase-emulator-suite
firebase emulators:start

# In another terminal:
npm run dev
```

Server will run on `http://localhost:5000`

## Firestore Collections Schema

### Circles Collection
```
{
  circles/{contractAddress}: {
    contractAddress: "0x...",
    name: "Circle Name",
    description: "Circle description",
    createdAt: "2026-04-02T12:00:00Z",
    updatedAt: "2026-04-02T12:00:00Z"
  }
}
```

### Invites Collection
```
{
  invites/{shortCode}: {
    shortCode: "ABC12345",
    contractAddress: "0x...",
    createdAt: "2026-04-02T12:00:00Z",
    expiresAt: "2026-05-02T12:00:00Z",
    used: false,
    joinedMembers: ["0xWallet1", "0xWallet2"]
  }
}
```

### Users Collection
```
{
  users/{walletAddress}: {
    walletAddress: "0x...",
    email: "user@example.com",
    enablePushNotifications: true,
    timezoneName: "America/New_York",
    circles: ["0xCircleAddress1", "0xCircleAddress2"],
    devices: [
      {
        fcmToken: "...",
        deviceName: "iPhone 14",
        registeredAt: "2026-04-02T12:00:00Z"
      }
    ],
    updatedAt: "2026-04-02T12:00:00Z"
  }
}
```

## API Endpoints

### Circle Metadata

**POST /api/circles/metadata** - Save circle metadata
```bash
curl -X POST http://localhost:5000/api/circles/metadata \
  -H "Content-Type: application/json" \
  -d '{
    "contractAddress": "0x...",
    "name": "My Circle",
    "description": "A savings circle"
  }'
```

**GET /api/circles/:contractAddress** - Get circle metadata
```bash
curl http://localhost:5000/api/circles/0x...
```

**GET /api/circles** - List all circles (paginated)
```bash
curl 'http://localhost:5000/api/circles?limit=50&offset=0'
```

**PUT /api/circles/:contractAddress** - Update circle metadata
```bash
curl -X PUT http://localhost:5000/api/circles/0x... \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "description": "Updated description"
  }'
```

### Invite Codes

**POST /api/invites** - Generate invite code
```bash
curl -X POST http://localhost:5000/api/invites \
  -H "Content-Type: application/json" \
  -d '{
    "contractAddress": "0x...",
    "expiresIn": 720
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "shortCode": "ABC12345",
    "inviteUrl": "/join/ABC12345",
    "expiresAt": "2026-04-30T12:00:00Z"
  }
}
```

**GET /api/invites/:code** - Resolve invite code
```bash
curl http://localhost:5000/api/invites/ABC12345
```

**POST /api/invites/:code/joined** - Record user joined via invite
```bash
curl -X POST http://localhost:5000/api/invites/ABC12345/joined \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x..."
  }'
```

**GET /api/invites** - List active invites
```bash
curl http://localhost:5000/api/invites
```

### User Preferences & Notifications

**POST /api/users/preferences** - Save user preferences
```bash
curl -X POST http://localhost:5000/api/users/preferences \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x...",
    "email": "user@example.com",
    "enablePushNotifications": true,
    "timezoneName": "America/New_York"
  }'
```

**GET /api/users/:walletAddress/preferences** - Get user preferences
```bash
curl http://localhost:5000/api/users/0x.../preferences
```

**POST /api/users/register-device** - Register device for push notifications
```bash
curl -X POST http://localhost:5000/api/users/register-device \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x...",
    "fcmToken": "Firebase-Cloud-Messaging-Token",
    "deviceName": "iPhone 14"
  }'
```

**POST /api/users/track-circle** - Track circle for notifications
```bash
curl -X POST http://localhost:5000/api/users/track-circle \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x...",
    "contractAddress": "0x..."
  }'
```

## Cloud Functions

### Scheduled Function: notifyContributionDeadlines
- **Trigger**: Every hour (0 * * * *)
- **Purpose**: Check for upcoming contribution deadlines (48h window) and send notifications
- **Deployed**: Firebase Cloud Functions

### HTTP Function: sendTestNotification
- **Endpoint**: `POST /sendTestNotification`
- **Purpose**: Send test push notification to a user
- **Body**: 
  ```json
  {
    "walletAddress": "0x...",
    "title": "Test Notification",
    "body": "This is a test"
  }
  ```

### HTTP Function: notifyCircleMembers
- **Endpoint**: `POST /notifyCircleMembers`
- **Purpose**: Send notification to all members of a circle
- **Body**:
  ```json
  {
    "circleAddress": "0x...",
    "title": "Circle Update",
    "body": "Contribution deadline approaching",
    "memberAddresses": ["0x...", "0x..."] // optional
  }
  ```

## Development Workflow

1. **Local Development with Emulator**
   ```bash
   firebase emulators:start
   npm run dev
   ```

2. **Testing Endpoints**
   - Use curl/Postman to test endpoints
   - Check Firebase Emulator UI at http://localhost:4000

3. **Deploy to Production**
   - Set `NODE_ENV=production` in `.env`
   - Run `firebase deploy`
   - Monitor Cloud Functions logs: Firebase Console → Cloud Functions

## Security Considerations

1. **Firestore Rules**: Public read for circles/invites, authenticated write
2. **API Keys**: Use Firebase Auth tokens in production
3. **Wallet Address Verification**: Verify via signature in production
4. **Rate Limiting**: Implement in production (not in MVP)
5. **Input Validation**: Add validation middleware in production

## Future Enhancements

- [ ] Implement Arc RPC calls for actual cycle data
- [ ] Add email notifications via SendGrid/Resend
- [ ] Implement webhook for on-chain events (Tenderly/Alchemy)
- [ ] Add user authentication with WalletConnect
- [ ] Batch notification optimization
- [ ] Analytics & logging
- [ ] Rate limiting & DDoS protection
- [ ] Pagination optimization with Firestore cursors

## Debugging

**Check Cloud Function Logs:**
```bash
firebase functions:log
```

**Monitor Firestore:**
- Firebase Console → Firestore → Collections
- Or: `firebase emulators:start` and visit http://localhost:4000

**Test Local Functions:**
```bash
firebase emulators:start
# In another terminal:
curl http://localhost:5001/projectId/region/sendTestNotification
```
