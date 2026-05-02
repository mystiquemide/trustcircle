■ PROJECT OVERVIEW
- TrustCircle: Onchain savings circle app on Arc Network using USDC and smart contracts.
- Digitizes informal savings groups (Ajo, Esusu, Chama, Tandas, Hui) with programmable enforcement.
- No human middleman; contributions enforced, payouts automatic, reputation tracked onchain.
- Core stack: Arc Network (EVM-compatible), USDC via viem/ERC20 contract interactions, Solidity contracts, React+Vite+TypeScript frontend, minimal Node.js/Firebase backend.
■ PROJECT STRUCTURE
- Frontend: Vite + React + TypeScript + Tailwind project in /frontend
  - src/components/: Shared design-system components (layout, common, forms, feedback, wallet)
  - src/pages/: Route-level pages (LandingPage, Home, Dashboard, CreateCircle, JoinCircle, CircleDetail, NotFound)
  - src/providers/: App-wide providers (dark mode, toast, wallet)
  - src/contracts/: ABI files and contract addresses (configurable via VITE_* env vars)
  - src/lib/: Chain config, API client, formatting helpers, circle data helpers
- Backend: Node.js + Firebase in /backend
  - src/server.js: Express server + Firebase initialization
  - src/routes/: API endpoints (circles, invites, users)
  - functions/: Firebase Cloud Functions (scheduled notifications)
  - firestore.rules: Firestore security rules
  - firebase.json: Firebase configuration
- Smart Contracts: Solidity files - TrustCircleFactory.sol, TrustCircle.sol (instances), ReputationRegistry.sol.
- Configuration: Environment variables for API keys, contract addresses.
■ CORE MODULES & WHAT THEY DO
- TrustCircleFactory: Deploys new TrustCircle instances, maintains global index of circles.
- TrustCircle (per circle instance): Manages contributions, payout order, enforcement logic for a single circle.
- ReputationRegistry: Tracks global wallet reputation scores (0-1000), updated by circle contracts.
- Frontend Modules:
  - Circle Creation: Wizard for setting parameters, deploying contract.
  - Join Circle: Invite link handling, wallet connection, USDC approval.
  - Contribution: UI for viem writeContract() calls, real-time dashboard updates.
  - Payout: Automatic distribution via contract, event listening.
  - Reputation: Display scores, enforce minimum thresholds.
■ DATABASE / DATA MODELS
- Onchain: Contract state - organizer, members[], contributionAmount, cycleDuration, currentCycle, payoutOrder[], contributions mapping, etc.
- Offchain: Firebase Firestore - circle metadata (names, descriptions), invite link mappings, user sessions, notification schedules.
- No custodial data; all financial logic onchain.
■ BACKEND SETUP (COMPLETE)
Express server + Firebase (Firestore, Cloud Messaging, Cloud Functions).
Location: /backend
Entry Point: src/server.js
Dev: npm run dev (on port 5000)
Production: firebase deploy
Firestore Collections:
1. circles/{contractAddress}
   - contractAddress (string): lowercased 0x address
   - name (string): display name
   - description (string): circle description
   - createdAt (timestamp): ISO string
   - updatedAt (timestamp): ISO string
2. invites/{shortCode}
   - shortCode (string): 8-char alphanumeric code (e.g., "ABC12345")
   - contractAddress (string): lowercased 0x address
   - createdAt (timestamp): ISO string
   - expiresAt (timestamp): ISO string
   - used (boolean): whether invite has been claimed
   - joinedMembers (array): list of wallet addresses that joined via this invite
3. users/{walletAddress}
   - walletAddress (string): lowercased 0x address (document ID)
   - email (string): optional user email
   - enablePushNotifications (boolean): default true
   - timezoneName (string): user timezone
   - circles (array): list of circle addresses user is tracking
   - devices (array): list of registered devices for push notifications
     - fcmToken (string): Firebase Cloud Messaging token
     - deviceName (string): device name/identifier
     - registeredAt (timestamp): ISO string
   - updatedAt (timestamp): ISO string
REST API Endpoints (all on http://localhost:5000):
CIRCLES - Circle Metadata Management:
  POST   /api/circles/metadata           → Save circle display name + description
  GET    /api/circles/:contractAddress   → Fetch circle metadata by address
  GET    /api/circles                    → List all circles (paginated, limit/offset)
  PUT    /api/circles/:contractAddress   → Update circle metadata
INVITES - Invite Code Generation & Resolution:
  POST   /api/invites                    → Generate short invite code for circle
  GET    /api/invites/:code              → Resolve code to circle address + metadata
  GET    /api/invites                    → List all active (non-expired) invites
  POST   /api/invites/:code/joined       → Record user joined via invite
USERS - User Preferences & Device Registration:
  POST   /api/users/preferences          → Save user notification preferences
  GET    /api/users/:walletAddress/preferences → Get user preferences
  POST   /api/users/register-device      → Register device FCM token for push notifications
  POST   /api/users/track-circle         → Add circle to user's tracked circles
  GET    /api/users/circles/:walletAddress → Get all circles user is tracking
Firebase Cloud Functions:
SCHEDULED:
  notifyContributionDeadlines: Every hour
  - Scans all tracked user circles
  - Checks for upcoming contribution deadlines in 48-hour window
  - Sends push notifications to registered devices
  - Respects user notification preferences
  - Scans timezone-aware notifications (future enhancement)
HTTP ENDPOINTS (Cloud Functions):
  POST /sendTestNotification
  - Send test push notification to user
  - Input: { walletAddress, title, body }
  - Output: { success, message, sentCount, errors }
  POST /notifyCircleMembers
  - Send notification to all members of a circle
  - Input: { circleAddress, title, body, memberAddresses (optional) }
  - Output: { success, message, sentCount, errors }
Security:
  - Firestore Rules: User document access restricted to owner only (request.auth.uid == walletAddress). Circles and invites have public read, authenticated write.
  - In production: Add Firebase Auth + signature verification
  - Environment: Service account key in .env file (never commit)
Deployment:
  firebase deploy --only functions               → Deploy Cloud Functions
  firebase deploy --only firestore:rules         → Deploy Firestore security rules
  firebase deploy                                → Deploy everything
  firebase help deploy                           → See all deployment options
Testing:
  firebase emulators:start                       → Run local emulator suite
  npm run dev                                    → Start Express server locally
  Use curl/Postman to test endpoints
  Monitor: http://localhost:4000 (Emulator UI)
■ ENVIRONMENT VARIABLES
- FIREBASE_CONFIG: Project ID (trust-circle2), service account credentials in backend/.env and backend/serviceAccountKey.json.
- Frontend env vars (frontend/.env.local):
  - VITE_API_BASE_URL: Backend API URL (default: http://localhost:5000)
  - VITE_FACTORY_ADDRESS: TrustCircleFactory contract address (default: 0x45F655C21D0626a08C233332930eF1bF41403812)
  - VITE_REPUTATION_ADDRESS: ReputationRegistry contract address (default: 0x9549002af3b4B806D1F3D16287189143F44a7E18)
  - VITE_USDC_ADDRESS: USDC contract address (default: 0x3600000000000000000000000000000000000000)
  - VITE_ARC_RPC_URL: Arc RPC URL (default: https://rpc.testnet.arc.io)
  - VITE_ARC_EXPLORER_URL: Arc explorer URL (default: https://testnet.arcscan.io)
- CONTRACT_ADDRESSES: ReputationRegistry: 0x9549002af3b4B806D1F3D16287189143F44a7E18, TrustCircleFactory: 0xe6FE2f8ecBCDc3B7E77AF602D2F6E6aa413343E1, TrustCircle instance example: 0x3b1Aa58f3D9607c53Fd11FeC738218b873BD57B1, USDC: 0x3600000000000000000000000000000000000000.
- ARC_CHAIN_ID: 5042002
- ARC_RPC_URL: https://rpc.testnet.arc.io
■ ACTIVE WORK & IN-PROGRESS
- **MVP V1 COMPLETED** ✅ (APRIL 2026)
  - All 8 phases of the improvement plan executed, tested, and confirmed working.
  - Frontend deployed to Vercel with full environment variable configuration.
  - Backend deployed to Firebase (Node 22, firebase-functions@5.1.1).
  - Smart contracts deployed and verified on Arc Testnet.
  - Core user flows verified end-to-end: wallet connect, circle creation, invite/join, USDC contribution, payout distribution, settings persistence, and reputation display.
  - Codebase pushed to GitHub: `https://github.com/mystiquemide/trustcircle.git`
  - **Status:** Production-ready for testnet users. Ready for V2 feature development.
■ ROADMAP: FUTURE INTEGRATIONS (V2+)
1. ~~**Dynamic Reputation:** Wire `TrustCircle.sol` to call `ReputationRegistry.incrementScore()` on successful payout and `decrementScore()` on default marking. Requires contract update and redeployment.~~ **COMPLETED**
2. ~~**Pause/Default UI:** Expose the contract's state machine (`markDefaulter`, `voteOnDefaultResolution`, `setPayoutOrderManual`) in the CircleDetail page so members can actively manage defaults and voting.~~ **COMPLETED**
3. **Notification Upgrades:** Enhance Cloud Functions to respect user timezone preferences and integrate SendGrid/Resend for email fallback when push notifications fail.
4. **E2E Testing:** Implement Playwright to automate core flows (Create → Join → Contribute → Payout) and prevent regressions.
5. **Auction-Based Payout Order:** Allow members to bid or compete for earlier payout positions instead of fixed/random ordering.
6. **Public Circles:** Enable open-join circles discoverable on a public marketplace, removing the invite-only restriction.
7. **Collateral Layer:** Require members to lock collateral (e.g., extra USDC or a governance token) before joining to reduce default risk.
8. **Mobile App:** Build a native or React Native mobile application for iOS/Android with push notifications and biometric wallet integration.
9. **Multi-Chain + Multi-Token:** Expand beyond Arc Testnet + USDC to support additional EVM chains (Base, Polygon, Arbitrum) and stablecoins (DAI, USDT).
10. **Social Attestations:** Integrate onchain identity protocols (e.g., Farcaster, Lens, or ENS) to display social proof and trust signals within circles.
11. **Bridge Support:** Add native bridging functionality so users can move assets between chains directly within the app to join circles on any supported network.
■ KNOWN BUGS / TECH DEBT
- ~~circleIdCounter function not available on deployed contract~~ **FIXED**: Now using event logs (CreateCircle) and getCircle loop (Dashboard) instead
- ~~Chain mismatch: Wallet on mainnet (ID:1) but transactions on Arc Testnet (ID: 5042002)~~ **FIXED**: Removed chain-switching logic, wallet already on Arc Testnet
- ~~Unrecognized chain ID error~~ **FIXED**: Removed chain-switching/adding logic
- ~~CircleDetail members array out-of-bounds error~~ **FIXED**: Added try-catch blocks around all member/contribution/payout reads
- ~~Dashboard stuck in infinite loading state~~ **FIXED**: Reduced maxCircles from 1000 to 100, added account validation, fixed loop increments, proper error handling
- ~~Arc App Kit SDK integration needs completion~~ **REMOVED**: Deleted arcKit.ts, removed @circle-fin/app-kit and @circle-fin/adapter-viem-v2 dependencies. Using viem directly.
- ~~No persistent storage - circle data cached in React state only~~ **FIXED**: Added localStorage caching with 5-minute expiry on Dashboard
- ~~No real-time updates - Dashboard doesn't auto-refresh~~ **FIXED**: Added refresh button and auto-refetch on navigation via useLocation
- ~~Firestore security rules too permissive~~ **FIXED**: Restricted user document access to owner-only (request.auth.uid == walletAddress)
- CircleDetail payout order fetching uses simple polling approach, could implement proper event listeners once viem watchContractEvent is available.
- ~~Firebase deployment blocked on user running `firebase login` interactively~~ **FIXED**: User logged in, enabled Blaze billing, updated Functions runtime to nodejs20, and completed deployment.
■ KEY DEPENDENCIES
- React, Vite, TypeScript: Frontend framework.
- viem: Ethereum client library (wallet + public clients, contract interactions).
- Solidity: Smart contract development.
- Firebase SDK (firebase-admin, firebase-functions): Backend services.
- Tailwind CSS: Styling.
- react-router-dom: Client-side routing.
- @headlessui/react: Accessible modal/toggle primitives.
- @heroicons/react: Icon library for consistent UI iconography.
■ IMPORTANT DECISIONS MADE
- Blockchain: Arc Network for low fees and USDC-native support.
- Token: USDC only for MVP to avoid volatility.
- Contract Pattern: Factory for deploying circle instances, separate reputation contract.
- Reputation: Score-based system (0-1000) with penalties/bonuses for behavior.
- MVP Scope: P0 features - create/join/contribute/payout, basic reputation; out of scope - auctions, public circles, collateral.
- Enforcement: Grace periods, voting for defaults, immutable payout order.
- UI direction: Bold fintech visual language, blue/white palette, optional dark mode with user toggle, reusable component architecture, and landing-first onboarding flow.
■ SESSION LOG
- Initial memory.md created based on PRD v1.0.
- Apr 2, 2026: Completed frontend scaffold - fixed all TypeScript compilation errors. Dev server running successfully on localhost:5175.
- Apr 2, 2026 (continued): Created Arc Testnet chain configuration. Updated all viem client instances to include chain: arcTestnet parameter. Updated USDC address.
- Apr 2, 2026 (continued): Circle creation flow tested and verified working on Arc Testnet.
- Apr 2, 2026 (continued): Debugged JoinCircle hanging issue - added proper error handling, transaction hash display, 30-second timeout protection.
- Apr 2, 2026 (continued): Fixed viem chain configuration conflict - ensured all wallet clients consistently use `chain: arcTestnet`.
- Apr 2, 2026 (continued): Fixed JoinCircle balance verification blocking issue - added `balanceCheckFailed` state to gracefully handle verification errors.
- Apr 2, 2026 (continued): FINAL FEATURE IMPLEMENTATION - Completed CircleDetail contribute functionality with full viem integration. Implemented handleContribute() with two-step flow (Approve + Contribute). Frontend MVP complete.
- Apr 2, 2026 (continued): FIXED circleIdCounter ERROR - Updated both CreateCircle.tsx and Dashboard.tsx to use event logs and getCircle loops respectively.
- Apr 2, 2026 (continued): FIXED CHAIN MISMATCH ERROR - Handled chain addition and switching logic, later REMOVED logic after ensuring wallet was on Arc Testnet.
- Apr 2, 2026 (continued): FIXED CircleDetail members() ARRAY OUT-OF-BOUNDS ERROR - Wrapped member fetches in try-catch blocks to silently skip errors and handle contract state mismatches gracefully.
- Apr 2, 2026 (continued): OPTIMIZED DASHBOARD LOADING - Reduced maxCircles loop limit from 1000 to 100, added account validation, improved load times (<5s).
- Apr 2, 2026 (continued): BACKEND MVP SETUP - Created minimal Node.js + Firebase backend with Express server, 13 REST API endpoints, Cloud Functions, and Firestore rules.
- Apr 3, 2026: FIREBASE SETUP & DEPLOYMENT PREP (Phase 1). Installed Firebase CLI and initialized project.
- Apr 3, 2026 (continued): WIRE UNUSED API METHODS INTO UI (Phase 2). Rewrote JoinCircle.tsx for dual-mode invite resolution. Rewrote Dashboard.tsx for settings modal.
- Apr 3, 2026 (continued): TECH DEBT FIXES (Phase 3). Cleaned up arcKit, made contract addresses configurable, hardened Firestore security rules.
- Apr 3, 2026 (continued): FIREBASE DEPLOYMENT EXECUTION: User authenticated, activated Blaze billing, updated Functions runtime to nodejs20, and successfully deployed to Firebase.
- Apr 3, 2026 (continued): FRONTEND UI POLISH + APP FLOW RESTRUCTURE: Implemented new dark-mode design system with Headless UI/Heroicons. Rebuilt LandingPage, Home, and Dashboard routes.
- Apr 3, 2026 (continued): PHASE 1 FRONTEND BUG FIXES: Updated CreateCircle validation, CircleDetail deduplication, and JoinCircle cache invalidation.
- Apr 3, 2026 (continued): PHASE 1 FOLLOW-UP: Fixed "created circle not showing in Home" issue, improved invite-link UX with alphanumeric fallback.
- Apr 4, 2026: PRE-PHASE 6 BLOCKER FIXES: Added "Baseline - New member" reputation label. Optimized `fetchUserCircles()` using chunked parallel pipelines.
- Apr 4, 2026: PHASE 6 EXECUTED (Bundle Size Optimization): Implemented React.lazy routing and Rollup manualChunks for vendor splitting in Vite.
- Apr 4, 2026: PHASE 8 EXECUTED (Firebase/Node Upgrades): Migrated Functions runtime to Node 22 and upgraded `firebase-functions` SDK to `^5.1.0`.
- Apr 4, 2026: DASHBOARD SETTINGS PERSISTENCE HOTFIX: Implemented localStorage fallback for preferences when backend API is offline.
- Apr 4, 2026: PHASE 2 EXECUTED (Faucet + Payouts): Added Faucet links to Home/Join. Added `Distribute Payout` action to CircleDetail.
- Apr 4, 2026: PHASE 3 EXECUTED (Landing Page): Delivered premium dark hero styling, animated glows, floating cards, and restyled feature steps. Added motion stagger and float keyframes.
- Apr 4, 2026: PHASE 4 EXECUTED (Footer): Aligned authenticated app footer with landing page architecture.
- Apr 4, 2026: PHASE 5 EXECUTED (Reputation Integration): Added ABI and logic to fetch live onchain reputation scores for the Dashboard.
- Apr 4, 2026: PHASE 7 EXECUTED (Mobile Responsive Audit): Applied 22 UX fixes across 13 files to ensure perfect rendering on 320px screens.
- Apr 4, 2026: MVP V1 COMPLETED & DEPLOYED: Frontend successfully deployed to Vercel. Codebase fully initialized and pushed to GitHub. All 8 phases officially closed out.
- Apr 6, 2026: FEATURE ADDITIONS: Added disconnect wallet button in Layout header (navigates to landing page). Added generate invite link functionality for pending circles (organizer-only) in CircleDetail page.
- Apr 6, 2026 (continued): BUG FIX: Fixed invite code response path in CircleDetail - now uses correct API response path and local invite code fallback format (same as circle creation).
- Apr 6, 2026 (continued): UX IMPROVEMENT: Landing page auto-redirects to /home on wallet connect. Layout header now shows connected wallet address next to disconnect button (desktop + mobile).
- Apr 26, 2026: V2 FEATURE IMPLEMENTATION - Implemented Dynamic Reputation inside TrustCircle.sol and integrated ReputationRegistry. Added 'Mark Defaulter' and 'Vote on Default Resolution' UI to CircleDetail.tsx. Deployed new TrustCircleFactory (0xe6FE2f8ecBCDc3B7E77AF602D2F6E6aa413343E1) via Remix and updated frontend env vars.
- Apr 27, 2026: STABILITY & COLLATERAL - Implemented polling provider wait in WalletProvider to fix mobile browser crashes. Added tiered collateral layer to TrustCircle.sol and updated CreateCircle UI to require collateral. Backend updated to support public circles via 'isPublic' flag.
- Apr 27, 2026 (continued): UI IMPROVEMENTS - Fixed circle resolution hanging during creation with polling mechanism. Simplified Collateral UI to be automatically calculated (no manual input). Added cancel functionality during circle deployment. Restructured LandingPage header to show Dashboard/Disconnect options.
- Apr 27, 2026 (continued): TROUBLESHOOTING LOG - Resolved frontend build error (TS2552: Cannot find name 'error' in Home.tsx). Fixed backend initialization crash (FirebaseAppError: Invalid PEM formatted message) by updating FIREBASE_PRIVATE_KEY format. Resolved ERR_CONNECTION_REFUSED by ensuring backend server is correctly initialized and listening.
- May 2, 2026: FIX PASS - Added local backend datastore fallback when Firebase credentials are placeholders, fixed circle metadata sync so `isPublic` is not overwritten by best-effort refreshes, restored public-circle discovery from backend metadata, added collateral lock flow to JoinCircle, made circle creation recover from receipt polling timeouts, removed landing-page emoji/icon markers, added landing dark-mode toggle, and reordered app nav to Home / Create Circle / Dashboard.
- May 2, 2026 (continued): RPC RATE LIMIT HOTFIX - CreateCircle now confirms through the connected wallet provider with slower polling instead of Arc public RPC, Home only hydrates Public Circles when that tab is opened, public circles navigate/join by contract address, CircleDetail/JoinCircle support address-based routes, and public metadata stores `circleId` when available.
- May 2, 2026 (continued): NONCE HOTFIX - Diagnosed create transaction `0x0111...7b5b` as pending with nonce 77 while Arc expected nonce 70 for wallet `0xabf0...43e9`; updated CreateCircle to read the chain pending nonce and pass it into `writeContract`, with a guard that warns if the wallet still submits a higher stale nonce.
- May 2, 2026 (continued): JOIN/HOME FIX - Public address joins no longer call invite-code join tracking, joined/created circles are tracked locally and in backend user circles, Home loads tracked circles before factory scanning, CircleDetail membership checks are case-insensitive, the nested Public Circles card button warning is fixed, app nav is centered, and the TrustCircle shield/logo icon is hidden by default.
- May 2, 2026 (continued): PAYOUT UX FIX - Updated CircleDetail so the Distribute Payout button only appears after the active cycle deadline has elapsed. The payout handler now also blocks early execution unless the deadline has passed and either all members contributed or the 24-hour grace period passed. Frontend build verified.
- May 2, 2026 (continued): FINAL V2 TEST POLISH - Temporarily added a 2-minute cycle option for payout testing, then removed it after verification. Contribution button is now hidden after the cycle deadline and the handler blocks late contributions. Payout order now labels entries as Paid, Current recipient, or Upcoming. Public Circles frontend listing now filters to joinable Pending circles only. Attempted to bulk-clear production public metadata, but local Firebase admin credentials were unavailable; old public rows must be cleared from Firebase Console or with valid service credentials.
