TrustCircle
Onchain Savings Circles — Product Requirements Document
Built on Arc Network · Powered by USDC · Enforced by Smart Contracts

Document Type	Version	Status	Date
Product Requirements Document	v1.0 — MVP	Draft for Engineering & Design	April 2026

Confidential — Internal Use Only

01	Product Summary

What is TrustCircle?
TrustCircle is an onchain savings circle application where groups of trusted users pool USDC weekly and rotate payouts. It digitizes and enforces the informal savings group model (known as Ajo, Esusu, Chama, Tandas, or Hui depending on geography) using smart contracts on Arc Network.

Every circle is governed entirely by code. Contributions are enforced, payouts are automatic, and reputation is tracked permanently onchain. There is no human middleman, no "I will pay tomorrow," and no trust required outside of the contract itself.

The One-Line Summary
TC	Pool money with people you know. Contribute weekly. Receive a full lump sum when it is your turn. The smart contract handles everything else.

Core Stack
Layer	Technology	Reason
Blockchain	Arc Network (EVM-compatible)	Low fees, USDC-native, Circle infrastructure
Token	USDC via Arc App Kit SDK	Stable, widely trusted, no volatility risk
Smart Contracts	Solidity (EVM)	Programmable enforcement, no custodian needed
Frontend	React + Vite + TypeScript	Fast, type-safe, existing ecosystem
Wallet	Viem adapter (Arc App Kit)	Native SDK integration for bridge/send/swap
Backend	Minimal Node.js / Firebase (temp)	Circle metadata, user sessions, notifications

02	Problem Statement

The Real Problem
Informal savings circles exist everywhere. Ajo in Nigeria, Chama in Kenya, Tandas in Latin America, Hui in China. They work because the social contract is strong in tight-knit communities. But they break the moment that contract weakens.

What actually goes wrong in traditional savings circles
•	One member collects the pot and disappears, leaving the group with no recourse
•	Late or missed contributions stall the entire rotation with no enforcement mechanism
•	Disputes over payout order lead to group breakdowns
•	No written record means no accountability when memories differ
•	Circle organizers carry too much personal liability and operational burden
•	Groups cannot scale beyond people who physically know and trust each other

Why Existing Solutions Fall Short
Alternative	Problem
WhatsApp savings groups	No enforcement, pure trust, high default rate
Traditional banks	High minimums, rigid products, no group savings primitive
Fintech savings apps	Custodial, centralized, not composable with DeFi
Manual spreadsheets	No automation, organizer carries all risk and admin
Informal digital transfers	Same trust problem, just faster transactions

The Opportunity
There are an estimated 200 million people globally who participate in informal savings circles. The majority are in Africa, Latin America, Southeast Asia, and South Asia. These users understand the product intuitively. They do not need to be educated on why savings circles work. They need a version that cannot be cheated.

KEY	TrustCircle does not invent a new behavior. It makes an existing one trustless.

03	Solution Overview

How TrustCircle Works
A user creates a savings circle and sets the parameters: number of members, contribution amount in USDC, contribution frequency, and payout order method. Members join by connecting their wallet and locking a deposit. Once the circle is full, it starts automatically.

Each cycle, members contribute USDC to the smart contract. The contract verifies contributions, and at the end of each cycle it distributes the full pot to the designated recipient for that round. This continues until every member has received a payout, at which point the circle closes or renews.

What the Smart Contract Enforces
•	Contribution deadlines — late contributions are flagged and penalized
•	Payout distribution — no manual release, automatic transfer on cycle close
•	Default handling — defaulters are marked onchain and removed from active circles
•	Order integrity — payout order is fixed at circle creation and cannot be altered

Arc App Kit Integration
TrustCircle uses the Arc App Kit SDK to handle all USDC movement. The SDK provides three core operations that map directly to TrustCircle's needs:

Arc SDK Method	TrustCircle Use Case
kit.send()	Member contributes USDC to the circle contract on Arc Testnet
kit.bridge()	User bridges USDC from another chain (e.g. Ethereum) into Arc to join a circle
kit.swap()	Future: allow members to contribute non-USDC tokens that get swapped before deposit

ARC	The Arc SDK removes the need to write custom bridge or token transfer logic. Contribution flow is a single kit.send() call with the circle contract as recipient.

04	User Flow

4.1 Create a Circle
Actor: Circle Organizer

•	Connect wallet (Viem-compatible wallet on Arc Network)
•	Navigate to 'Create Circle'
•	Set circle parameters:
◦	Circle name
◦	Number of members (min 3, max 20 for MVP)
◦	USDC contribution per cycle (fixed, e.g. 50 USDC)
◦	Cycle duration (weekly, biweekly, or monthly)
◦	Payout order method (random draw or manual organizer assignment — MVP)
•	Review and confirm parameters
•	Deploy circle contract — wallet prompts for gas
•	Receive unique invite link to share with members

4.2 Join a Circle
Actor: Member

•	Receive invite link from organizer
•	Open TrustCircle app, connect wallet
•	Review circle terms: contribution amount, cycle count, schedule, own payout position
•	Approve USDC spend and sign join transaction
•	Contract records member address and assigned payout position
•	Circle starts automatically once all member slots are filled

4.3 Weekly Contribution
Actor: All members

•	App sends push/email reminder 48 hours before deadline
•	Member opens app, sees active circle dashboard with current cycle status
•	Member clicks 'Contribute' — kit.send() executes the USDC transfer to contract
•	Contract records contribution and emits event
•	Dashboard updates in real time to show which members have contributed
•	If deadline passes without contribution, contract calls markDefaulter()

4.4 Payout Distribution
Actor: Smart contract (automatic)

•	At cycle close, contract verifies all contributions received
•	Contract calls distributePayout() and transfers full pot to the current recipient
•	Transaction hash emitted and visible in the app
•	Next cycle begins immediately with the next recipient in order
•	All members can verify the payout on the Arc explorer

4.5 Edge Cases
Scenario	System Behavior
Member misses contribution deadline	markDefaulter() called, member flagged, reputation score decremented, circle paused pending resolution logic (see Section 7)
Member tries to join after circle is full	Contract rejects join transaction, UI shows 'Circle is full'
Organizer tries to change payout order after start	Contract rejects — payout order immutable after circle starts
Member loses wallet access	Recovery is user's responsibility in MVP. Future: social recovery module
Circle never fills (organizer creates but no one joins)	Organizer can cancel circle before it starts, no funds at risk
Member wants to exit mid-circle	Not permitted in MVP. Future: exit auction or collateral slash

05	Features Breakdown

5.1 Circle Creation System
•	Organizer sets all parameters in a 3-step wizard UI
•	Parameters are passed to the createCircle() contract function
•	Each circle is a deployed contract instance (factory pattern)
•	Organizer pays deployment gas, which is low on Arc Network
•	Invite link generated from circle contract address

5.2 Contribution Mechanism
•	All contributions are in USDC — no other tokens in MVP
•	Contribution amount is fixed and set at circle creation
•	kit.send() from Arc App Kit handles the transfer
•	Contract timestamps each contribution and maps it to the sender's address
•	Frontend polls contract events to update dashboard in real time

5.3 Payout Engine
•	Payout order is set at creation and stored in contract state
•	distributePayout() is callable by any member at cycle close (trustless trigger)
•	Contract verifies all contributions received before releasing funds
•	Full pot (members × contribution amount) is sent in a single transfer
•	No partial payouts, no manual confirmation from organizer

5.4 Enforcement Logic
•	Contribution deadline is enforced by block timestamp comparison
•	Grace period: 24 hours after deadline before default is marked
•	First offense: warning flag, reputation decrement, circle pause
•	Second offense in same circle: removal from circle, reputation hit
•	All enforcement actions are emitted as contract events and visible in UI

5.5 Reputation System
•	Every wallet address has an onchain reputation score (0–1000, starts at 500)
•	Score increases with consistent on-time contributions
•	Score decreases with late contributions, defaults, and incomplete circles
•	Score is checked when joining a circle — organizers can set a minimum threshold
•	Score is fully public and queryable from the reputation contract
Detailed scoring model is in Section 6.

06	Smart Contract Design

6.1 Contract Architecture
TrustCircle uses a factory pattern. One TrustCircleFactory contract is deployed once. Each savings circle is a separate TrustCircle instance deployed by the factory. A separate ReputationRegistry contract tracks scores globally across all circles.

Contract	Responsibility
TrustCircleFactory	Deploys new TrustCircle instances, maintains index of all circles
TrustCircle (instance)	Manages a single circle: contributions, payout order, enforcement
ReputationRegistry	Global wallet reputation scores, readable by all circle contracts

6.2 TrustCircle — State Variables
The following state is stored per circle instance:

Variable	Type	Description
organizer	address	Wallet that created the circle
members	address[]	Ordered list of member wallets
contributionAmount	uint256	Fixed USDC amount per cycle
cycleDuration	uint256	Seconds per cycle
currentCycle	uint256	Index of active cycle (0-based)
payoutOrder	address[]	Fixed order of recipients
contributions	mapping(uint=>mapping(address=>bool))	Cycle → member → contributed
cycleStart	uint256	Block timestamp of current cycle start
status	enum	Pending / Active / Paused / Completed
usdcToken	address	USDC contract address on Arc

6.3 Core Functions

createCircle()
Called by TrustCircleFactory. Initializes circle state. Sets organizer, memberCap, contributionAmount, cycleDuration, and payoutOrderMethod. Status set to Pending.

joinCircle(address member)
Called by a member wallet. Requires circle status == Pending and member count below cap. Adds member to members[]. If the circle reaches capacity, status flips to Active and cycleStart is set.

contribute()
Called by a member each cycle. Requires status == Active, block.timestamp within the cycle window, and msg.sender is a registered member. Transfers contributionAmount USDC from sender to contract. Marks contributions[currentCycle][msg.sender] = true.

distributePayout()
Callable by any member after all contributions are received or the cycle window has closed. Verifies contribution state. Transfers full pot to payoutOrder[currentCycle]. Increments currentCycle. If all cycles done, sets status to Completed.

markDefaulter(address member)
Called internally after the grace period if a contribution is missing. Emits DefaultOccurred event. Calls ReputationRegistry.decrementScore(member). Pauses circle pending resolution.

6.4 Arc App Kit Integration in Contract Layer
The contribute() function does not call the Arc SDK directly — the SDK is used on the frontend. The frontend calls kit.send() which produces a signed USDC transfer. The contract receives the USDC and records the contribution. The flow is:

FLOW	Frontend: kit.send({ from: memberWallet, to: circleContractAddress, amount: '50.00', token: 'USDC' }) → Contract: contribute() detects USDC received → marks contribution

6.5 Events
Event	Emitted When
CircleCreated(circleId, organizer)	New circle deployed
MemberJoined(circleId, member)	Member joins a circle
ContributionReceived(circleId, cycle, member)	USDC contribution recorded
PayoutDistributed(circleId, cycle, recipient, amount)	Payout sent to recipient
DefaultOccurred(circleId, cycle, member)	Member marked as defaulter
CircleCompleted(circleId)	All cycles completed

07	Reputation System

7.1 Score Mechanics
Every wallet that interacts with TrustCircle has a reputation score stored in the ReputationRegistry contract. The score is a uint256 in the range 0–1000, initialized to 500 on first interaction.

Action	Score Change	Notes
On-time contribution	+5	Applied per successful cycle contribution
Early contribution (>24h before deadline)	+8	Bonus for proactive behavior
Late contribution (within grace period)	-10	Applied if contributed after deadline but before grace period ends
Default (missed contribution entirely)	-50	Applied when markDefaulter() is called
Completed a full circle without default	+30	Bonus on CircleCompleted event
Removed from circle due to second default	-100	Severe penalty

7.2 Score Usage
•	Organizers can set a minimum reputation score when creating a circle (e.g. score >= 400 to join)
•	Score is displayed on member profiles in the app
•	Future: score feeds into a credit limit system for collateral-free circles

7.3 Anti-Gaming Considerations
•	Score cannot be transferred or sold — it is tied to a wallet address
•	Creating a new wallet resets score to 500, not higher — no advantage in churning wallets
•	Minimum 3 completed circle cycles required before score bonuses are fully weighted
•	Future: social attestation (Worldcoin, ENS) to bind score to real identity

08	System Architecture

8.1 Architecture Overview
Layer	Technology	Role
Frontend	React + Vite + TypeScript + Tailwind	Circle creation, contribution UI, dashboard, payout history
Wallet Layer	Viem adapter via Arc App Kit	Wallet connection, USDC send, bridge from other chains
Arc SDK	@circle-fin/app-kit + @circle-fin/adapter-viem-v2	Handles USDC send, bridge, swap operations
Smart Contracts	Solidity on Arc Network (EVM)	TrustCircleFactory, TrustCircle instances, ReputationRegistry
Backend (minimal)	Node.js + Firebase Firestore	Circle metadata, notification triggers, invite link resolution
Notifications	Firebase Cloud Messaging or Resend	Email/push reminders for contribution deadlines
Indexer (future)	The Graph or custom event listener	Query circle state history, member analytics

8.2 Data Flow: Contribution
1. Member opens app and sees active circle with contribution due.
2. Member clicks 'Contribute.' Frontend calls kit.send() with circle contract as recipient.
3. Arc App Kit constructs and signs the USDC transfer via the Viem adapter.
4. Transaction submitted to Arc Network.
5. TrustCircle contract receive() hook detects USDC, calls internal _recordContribution().
6. ContributionReceived event emitted.
7. Frontend listens for event, updates dashboard.

8.3 Data Flow: Bridge and Join
For users with USDC on Ethereum or another chain:
1. User clicks 'Bridge USDC to Arc' on the join screen.
2. Frontend calls kit.bridge({ from: Ethereum_Sepolia, to: Arc_Testnet, amount: '50.00' }).
3. USDC arrives in user's wallet on Arc.
4. User proceeds to joinCircle() as normal.

UX	The Arc App Kit bridge integration means users do not need to understand cross-chain mechanics. One button moves their USDC into the right place.

8.4 Backend Scope (Minimal)
The backend handles only what the smart contract cannot: off-chain metadata (circle display names, descriptions, invite link mappings) and notification scheduling. It never holds funds or has custody over any user asset. All financial logic lives onchain.

09	Risk and Security Model

9.1 Risk Matrix
Risk	Likelihood	Impact	Mitigation
Member defaults on contribution	High	High	Grace period, markDefaulter(), circle pause, reputation penalty
Smart contract bug causing fund loss	Low	Critical	Audit before mainnet, formal verification on payout logic, testnet-only for MVP
Sybil attack (one person fills circle with fake wallets)	Medium	High	Minimum reputation score requirement, invite-only circles, future social attestation
USDC depeg or Circle insolvency	Very Low	High	Out of scope for MVP; diversification is user's responsibility
Organizer attempts to manipulate payout order	Medium	High	Payout order immutable after circle start — enforced at contract level
Frontend compromised (phishing)	Medium	Medium	All approvals require wallet signature; frontend cannot move funds unilaterally

9.2 Default Handling Logic
When a default occurs, the circle enters a Paused state. In MVP, resolution requires all remaining active members to vote (simple majority) on one of two options:
•	Continue without the defaulter — remove their future payout slot, refund remaining members proportionally
•	Dissolve the circle — distribute all held USDC back to contributors proportionally

Both paths are handled by contract functions with no organizer override possible.

9.3 Audit Plan
•	Phase 1 (MVP/Testnet): Internal review of all contract functions
•	Phase 2 (Before mainnet): Independent audit by a recognized EVM security firm
•	Phase 3 (Post-audit): Bug bounty program with defined scope and rewards
•	No user funds on mainnet until audit is complete and critical findings resolved

10	MVP Scope

What is In Scope for MVP
Feature	Description	Priority
Create circle	Organizer deploys a circle with fixed params	P0
Join circle	Member joins via invite link, approves USDC	P0
Weekly USDC contribution	kit.send() to contract, on-time tracking	P0
Automatic payout distribution	distributePayout() at cycle close	P0
Basic reputation score	On-time / default tracking, score display	P0
Default detection and circle pause	markDefaulter(), pause state	P0
Default resolution (vote to continue or dissolve)	Simple majority vote onchain	P1
Bridge USDC from other chains	kit.bridge() on join screen	P1
Member dashboard	Contribution history, payout schedule, score	P1
Invite links	Shareable link tied to contract address	P1
Email/push reminders	48h before deadline	P2

What is Explicitly Out of Scope for MVP
•	Auction-based payout ordering
•	Public circles (strangers joining without invite)
•	Collateral system
•	Mobile native app (web-responsive only for MVP)
•	Multi-token contributions
•	Circle renewal after completion
•	Social attestation or KYC

MVP	MVP goal: prove the core loop works safely on testnet with real users. Do not add features until the base is solid.

11	Product Roadmap

Phase	Timeline	Key Deliverables
MVP (Testnet)	Months 1–2	Core contracts deployed, create/join/contribute/payout loop working, basic UI, reputation contract
V1 (Mainnet Alpha)	Months 3–4	Audit complete, mainnet deployment, notification system, bridge integration, invite system
V2 (Growth)	Months 5–7	Public circles, auction payout ordering, reputation-gated circles, mobile responsive polish
V3 (Scale)	Months 8–12	Credit scoring for collateral-free higher-value circles, social attestation, DAO governance for protocol parameters

V2 Feature: Auction Payout Ordering
Members bid USDC for earlier payout positions. Highest bidder gets first payout. Bid amounts are distributed as bonuses to later-position members. This adds a yield mechanism for patient participants.

V3 Feature: Credit Scoring and Collateral
High-reputation wallets with 3+ completed circles and consistent scores above 800 can join higher-value circles without upfront collateral. Their reputation score acts as their creditworthiness signal. Defaults from these wallets carry heavier penalties to price the risk correctly.

12	Go-To-Market Strategy

12.1 Target Users
Segment	Profile	Why They Need TrustCircle
Existing savings circle members	Non-crypto users in Nigeria, Kenya, Ghana, Mexico, Philippines	Already understand the product. Need trust enforcement, not education
Crypto-native degen savers	DeFi users who want structured savings with yield potential	Familiar with USDC, wallets, onchain protocols
Diaspora communities	Immigrants sending money home, rotating savings informally	High default risk due to distance, perfect use case for trustless enforcement
Young professionals	25–35 urban workers who participate in office or church savings groups	Digital-first, comfortable with apps, frustrated by informal group dysfunction

12.2 Launch Strategy
Phase 1: Closed Beta (Testnet)
•	Recruit 5–10 trusted testers to form the first real circles
•	Each tester brings their own existing savings circle group
•	Use testnet USDC so no real money is at risk
•	Gather structured feedback on UX friction, default handling, and trust

Phase 2: Community Launch
•	Publish a detailed launch thread on X explaining the problem and how TrustCircle solves it
•	Partner with 2–3 community leaders in African fintech/crypto Twitter to co-host the first public circles
•	Offer a small USDC incentive (from treasury) to the first 50 circles completed on mainnet

Phase 3: Viral Loop
•	Every invite link is tied to the organizer's address — referral tracking is native
•	Completed circle members get a soulbound NFT proof-of-circle badge
•	Badge is shareable and verifiable — social proof that drives new circle creation

12.3 Positioning
TrustCircle is not positioned as a crypto app to the non-crypto user. It is positioned as a better Ajo, a smarter Chama, a fair Tanda. The blockchain layer is infrastructure, not the story. The story is: your money is safe, and nobody can cheat.

GTM	Lead with the problem users already know. The technology is the solution, not the pitch.

