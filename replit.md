# Overview

This project is a political campaign management system designed to streamline voter engagement, team coordination, and communication through WhatsApp. It integrates a React frontend, Express backend, PostgreSQL database, and various AI agents. Key capabilities include managing voters, campaign materials, and team structures, alongside intelligent automation for WhatsApp communications via agents like the Clone Agent (personalized engagement), Militant Agent (group discussions), Collector Agent (contact syncing), and Instagram Agent (social media monitoring). The system aims to enhance campaign efficiency and reach through automated, personalized, and group-based interactions.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The frontend is built with React and TypeScript, using Vite for development and bundling. It leverages Shadcn UI components (based on Radix UI and Tailwind CSS) for a consistent "new-york" style design. State management for server data is handled by TanStack Query, while Wouter provides lightweight client-side routing with authentication protection. Form handling uses React Hook Form with Zod for validation. The application features a tab-based layout for major features and is designed to be mobile-responsive with a collapsible sidebar.

## Backend Architecture

The backend is an Express.js application written in TypeScript. It provides a RESTful API with session-based authentication, storing sessions in PostgreSQL via `connect-pg-simple`. Drizzle ORM is used for type-safe database interactions and migrations. Business logic for AI agents is organized into `workflows`, background tasks in `workers`, and utilities in `lib`. The system employs a worker pattern with interval-based schedulers for processing message queues (Clone and Militant Agents), Instagram monitoring, and contact syncing. Custom error handling is implemented with centralized middleware.

## Data Storage Solutions

The primary data store is PostgreSQL, accessed via connection pooling. For semantic search, the system uses OpenAI embeddings, with TF-IDF as a fallback, storing embeddings as JSON strings due to current database limitations. PostgreSQL also serves as the session store for authentication.

## Authentication and Authorization

The system uses session-based authentication with bcrypt-hashed passwords. Sessions are secured with HttpOnly, SameSite, and Secure cookies, expiring after 24 hours. A `requireAuth` middleware protects routes, ensuring only authenticated users can access certain parts of the application.

# External Dependencies

### WhatsApp Integration (WAHA)

**Service**: WAHA (WhatsApp HTTP API) - a self-hosted solution for WhatsApp integration.
**Features Used**: Sending various message types, receiving webhooks, managing contacts/groups, and queue management.

**Centralized Credentials**: WAHA credentials are managed through environment variables:
- `WAHA_URL`: Base URL for the WAHA API server
- `WAHA_API`: API key for WAHA authentication
- These are injected server-side when creating/updating agent instances
- Agent forms only require selecting an existing WAHA session from `/instancias`

**Instance Management**: The `/instancias` page provides a UI for managing WAHA sessions:
- Create new instances/sessions
- Delete existing instances
- Reconnect (logout + start) to generate new QR codes
- Connect (start) stopped instances
- Display QR codes for authentication with automatic polling
- Backend routes: POST/DELETE/GET `/api/waha/instances/*`

**Agent Integration**: All agent types (Clone, Replicador, Coletor, Militant) now select WAHA sessions from existing instances rather than configuring credentials directly. The backend fills `wahaUrl` and `wahaApiKey` from environment variables.

### AI/LLM Services

**Ollama**: Self-hosted LLM service used by Clone and Militant Agents for conversational AI, with an OpenAI-compatible API and queue-based request handling.
**OpenAI API**: Utilized for audio transcription (Whisper), image description (GPT-4 Vision), and generating text embeddings (text-embedding-ada-002 model).

### Social Media Monitoring

**Apify Instagram Scraper**: A third-party service for monitoring Instagram posts, fetching media and captions for the Instagram Agent.

### Database Service

**Neon Serverless PostgreSQL**: Cloud-hosted PostgreSQL database used as the primary data store.

### Additional Services

**File Type Detection**: `file-type` npm package for MIME type identification.
**Document Processing**: `mammoth` for DOCX and custom logic for PDF text extraction.
**Timezone Management**: `luxon` for accurate timezone handling (America/Sao_Paulo).
**Excel Export**: `xlsx` library for generating spreadsheet exports.