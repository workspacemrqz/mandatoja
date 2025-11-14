# Overview

This is a political campaign management system built with React (frontend), Express (backend), PostgreSQL database, and WhatsApp integration via WAHA API. The application manages voters, campaign materials, team members (leaderships and assessors), and intelligent AI agents that automate WhatsApp communications. The system includes multiple AI agents: Clone Agent (personalized voter engagement), Militant Agent (group discussions), Collector Agent (contact syncing), Instagram Agent (social media monitoring), and Replicador/Coletor agents (campaign material distribution).

# Recent Changes

**November 13, 2025**: Fixed Militant Agent not receiving group messages
- **Problem**: Group messages were rejected before reaching militant agent processing
- **Root Cause 1**: Phone number extraction was attempted for group IDs, which have 18 digits and fail validation
- **Root Cause 2**: The code would return early when no valid phone was found, preventing militant agent from processing
- **Solution**: 
  - Reorganized webhook flow to branch on `isGroup` immediately
  - Group messages now go directly to militant agent without phone extraction
  - Individual messages continue to Clone Agent with phone validation
  - Added `fromMe` and `from` fields to militant queue messages
- **Result**: Militant Agent now receives and processes group messages correctly

**November 13, 2025**: Fixed critical vote detection bug - rejections no longer marked as confirmed votes
- **Root Cause**: Duplicate vote detection logic with flawed function that only checked positive patterns
- **Solution**: Removed duplicate detection (lines 1390-1397) and deleted flawed `detectVotingIntention` function
- **Enhancements**: Improved rejection patterns and added missing support patterns ("estou com você", "apoio total")
- **Test Results**: Created comprehensive test suite with 16 cases - 100% success rate
- **Impact**: System now correctly differentiates between voter support and rejection

**November 13, 2025**: Implemented Chat Inbox interface for Clone Agent conversations with full mobile responsiveness
- **Chat Page**: New `/chat` route with WhatsApp-style inbox layout (conversation list + message thread)
- **API Endpoints**: Added `GET /api/clone-agent/conversations` and `GET /api/clone-agent/conversations/:id/messages`
- **Filtering**: Instance filter dropdown and name/phone search with debounced input
- **Real-time Updates**: Automatic polling every 5 seconds when window is focused
- **Mobile Responsiveness**: Master-detail pattern with toggle between list and chat views
  - Mobile (< 768px): Shows list OR chat, with back button navigation
  - Desktop (≥ 768px): Shows both columns side-by-side
  - Auto-escape protection: Returns to list if selected conversation disappears
  - Resize handling: Automatically adjusts layout when crossing breakpoint
- **Message Display Mask**: Added `extractMessageText()` helper function to parse JSON-stringified messages
  - Extracts clean text from `{"content":"...", "timestamp":"...", ...}` format
  - Displays only message content without JSON metadata
  - Works with both legacy and new message formats
- **Registered Voters Only Filter**: Chat inbox now shows ONLY conversations from registered voters
  - Changed from `leftJoin` to `innerJoin` in `getCloneAgentConversations()`
  - Automatically excludes conversations without corresponding voter in database
  - Ensures all displayed conversations have valid voter registration
- **Data Normalization**: Guaranteed JSON string format for messages field with centralized normalization
- **Zod Validation**: All query parameters validated with proper schemas
- **Type Safety**: Fixed 11+ LSP errors in storage layer with proper null handling
- **Storage Methods**: `getCloneAgentConversations()` and `getCloneAgentConversationMessages()` with voter join

**November 13, 2025**: Complete fix for WhatsApp number extraction with centralized validation
- **Centralized Function**: Created `extractPhoneNumber()` in `/server/lib/whatsapp-normalizer.ts` 
- **Hierarchical Extraction with Loop**: Uses array-based loop to try ALL fields in priority order
  - Priority: Chat → Sender → phone/chatId → from → fromChat (NEVER SenderAlt!)
  - **Critical Fix**: Continues through entire hierarchy even when fields contain @lid
  - Previous bug: if-else structure stopped at first field with @lid, now loops through all
- **@lid Filtering**: ALL fields ending with `@lid` are automatically SKIPPED (they contain internal IDs, not phone numbers)
  - Example: `154502942425112@lid` → Logged and skipped, continues to next field
  - Forces extraction from fields with real numbers (ending with @s.whatsapp.net or @c.us)
  - System only returns null if ALL fields are empty or contain @lid
- **Webhooks Updated**: Both `/api/webhook/waha` and `/api/webhooks/whatsapp` now use centralized function
- **Strict Validation**: `extractPhoneNumber()` distinguishes Brazilian, international, and internal IDs
  - **Brazilian numbers** (start with 55): 12-13 digits strict validation
  - **International numbers**: 10-15 digits (E.164 standard) with valid country code verification
  - **Country Code Validation**: Numbers with 14+ digits MUST start with a known country code (1, 7, 20-999)
  - **Internal IDs**: Numbers without valid country codes OR >15 digits OR @lid suffix → Automatically rejected and return null
  - Webhooks abort processing when no valid phone number is extracted
- **Database Cleanup**: 
  - First pass: Removed 14 voters with 15+ digit internal IDs
  - Second pass: Removed 2 additional voters with 14-digit IDs lacking valid country codes (54173026508818, 61474504487027)
  - Total cleanup: 16 voters and 16 conversations removed
- **Zero Tolerance**: System now NEVER accepts or saves internal IDs as phone numbers
- **Rationale**: Combination of @lid filtering + length validation (12-13 for BR, 10-15 for international) + country code verification for 14+ digit numbers prevents ALL internal IDs while preserving legitimate international contacts

**November 12, 2025**: Initial fix for WhatsApp number extraction
- **Critical Issue**: Identified that `SenderAlt` contains internal IDs, not real phone numbers
- **Root Cause**: Webhook was using wrong field for phone extraction

**November 11, 2025**: Added configurable send delay for Clone Agent messages
- New field `sendDelaySeconds` in Clone Agent configuration (range: 1-60 seconds, default: 5)
- UI input added in "Configurações Básicas" tab for easy adjustment
- Backend calculates typing duration with ±2 second jitter for natural human-like behavior
- Typing duration is bounded between 1-60 seconds to maintain realistic messaging patterns

**November 10, 2025**: Implemented robust duplicate prevention for Instagram Agent (Replicador)
- Enhanced to send ALL new posts instead of just the latest one
- Added timestamp-based fallback when lastPostId is not found in API batch
- Posts are now processed sequentially in chronological order (oldest to newest)
- Each post is marked as processed individually for better fault tolerance
- 3-second delay between posts to prevent rate limiting
- System now handles up to 20 posts per execution (configurable)

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework**: React with TypeScript, using Vite as the build tool and development server.

**UI Library**: Shadcn UI components based on Radix UI primitives, styled with Tailwind CSS. The design system uses a "new-york" style preset with custom color variables and CSS theming.

**State Management**: TanStack Query (React Query) for server state management with optimistic updates and cache invalidation. No global client state management library is used.

**Routing**: Wouter for lightweight client-side routing with protected routes requiring authentication.

**Form Handling**: React Hook Form with Zod schema validation for type-safe form submissions.

**Component Structure**: The application uses a tab-based layout where each major feature (Dashboard, Voters, Team, Materials, Agents, Schedulings, Settings) is implemented as a separate tab component. Mobile-responsive design with collapsible sidebar navigation.

## Backend Architecture

**Framework**: Express.js with TypeScript running on Node.js.

**API Design**: RESTful API with session-based authentication using express-session with PostgreSQL session store.

**Session Management**: Sessions are stored in PostgreSQL using connect-pg-simple, with secure cookies configured for production (httpOnly, sameSite, secure flags).

**Database ORM**: Drizzle ORM for type-safe database queries with PostgreSQL dialect. Database migrations are managed via Drizzle Kit.

**File Organization**: 
- `/server/routes.ts` - API endpoint definitions
- `/server/workflows/` - Business logic for AI agent workflows
- `/server/workers/` - Background job processors
- `/server/lib/` - Utility libraries and external service clients
- `/shared/schema.ts` - Shared database schema and validation types

**Background Processing**: Worker pattern with interval-based schedulers for:
- Clone Agent message queue processing (10-second intervals)
- Militant Agent message queue processing (10-second intervals)
- Scheduled message delivery worker
- Instagram Agent monitoring (3-hour intervals)
- Collector Agent syncing (5-minute intervals)

**Error Handling**: Custom error classes (e.g., DuplicateWhatsAppError) with centralized error handling middleware.

## Data Storage Solutions

**Primary Database**: PostgreSQL accessed via connection pooling (node-postgres).

**Vector Storage**: The system implements a hybrid approach for semantic search:
- Primary: OpenAI embeddings API for generating vector embeddings
- Fallback: TF-IDF based similarity search when OpenAI is unavailable
- Storage: Embeddings stored as JSON strings in text columns (workaround for pgvector extension limitations)

**Session Store**: PostgreSQL table for session persistence using connect-pg-simple.

**Caching Strategy**: React Query provides client-side caching with configurable stale times. Server-side caching is minimal, relying on database performance.

## Authentication and Authorization

**Authentication Method**: Session-based authentication with username/password credentials stored with bcrypt hashing.

**Session Security**: 
- HttpOnly cookies to prevent XSS attacks
- SameSite cookie policy (none in production for cross-domain, lax in development)
- Secure flag enabled in production
- 24-hour session expiration
- Trust proxy configuration for deployment behind reverse proxies

**Authorization**: Simple role-based access with a single authenticated user role. Protected routes use a `requireAuth` middleware that checks session authentication status.

**Password Hashing**: bcrypt with configurable salt rounds for secure password storage.

## External Dependencies

### WhatsApp Integration (WAHA)

**Service**: WAHA (WhatsApp HTTP API) - self-hosted WhatsApp Business API solution.

**Configuration**: 
- `WAHA_URL` - Base URL of WAHA instance
- `WAHA_API_KEY` - API authentication key
- `WAHA_SESSION` - WhatsApp session identifier

**Features Used**:
- Send text messages, images, videos
- Receive webhooks for incoming messages
- Typing indicators and reactions
- Contact and group management
- Message queue management

**Client Implementation**: Centralized client in `/server/lib/waha-client.ts` with typed interfaces for all API operations.

### AI/LLM Services

**Ollama**: Self-hosted LLM service for Clone Agent and Militant Agent conversations.
- Base URL configurable via `OLLAMA_BASE_URL`
- Uses OpenAI-compatible API format
- Queue-based request management to prevent overload
- Fallback mechanisms when service is unavailable

**OpenAI API**: Used for specialized tasks:
- Whisper API for audio transcription
- GPT-4 Vision for image description
- Embeddings API for semantic search (text-embedding-ada-002 model)
- Configuration: `OPENAI_API_KEY_EMBEDDINGS`

### Social Media Monitoring

**Apify Instagram Scraper**: Third-party service for monitoring Instagram posts.
- Configuration: `APIFY_API_TOKEN`
- Fetches posts, captions, and media URLs
- Filters out pinned posts
- Used by Instagram Agent workflow

### Database Service

**Neon Serverless PostgreSQL**: Cloud-hosted PostgreSQL database with serverless architecture.
- Connection via `@neondatabase/serverless` package
- Configured through `DATABASE_URL` environment variable
- Supports connection pooling and prepared statements

### Additional Services

**File Type Detection**: `file-type` npm package for MIME type detection of uploaded media.

**Document Processing**: 
- `mammoth` for DOCX file extraction
- Custom PDF text extraction (binary pattern matching)
- Supports images, audio, video, and document analysis

**Timezone Management**: `luxon` library for accurate timezone handling (America/Sao_Paulo).

**Excel Export**: `xlsx` library for generating spreadsheet exports of voters, materials, and team data.

### Deployment Platform

**Replit**: Cloud-based development and deployment platform.
- Domain configuration via `REPLIT_DEV_DOMAIN` or `REPLIT_DOMAINS`
- Development plugins: runtime error overlay, cartographer, dev banner
- Trust proxy configuration for production deployment