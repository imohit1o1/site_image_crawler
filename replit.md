# Site Image Crawler

## Overview

This is a web-based image crawling application that allows users to scan websites and extract all images found on the pages. The application consists of a React frontend with a clean, modern interface built using shadcn/ui components, and an Express.js backend that handles the crawling operations using Puppeteer. Users can submit URLs to crawl, monitor progress in real-time, and view detailed results of all discovered images including metadata like alt text, dimensions, and source pages.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: shadcn/ui components built on Radix UI primitives with Tailwind CSS styling
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation for type-safe form handling
- **Styling**: Tailwind CSS with custom CSS variables for theming

### Backend Architecture  
- **Framework**: Express.js with TypeScript
- **Web Crawling**: Puppeteer for headless browser automation to extract images from web pages
- **Database ORM**: Drizzle ORM configured for PostgreSQL with type-safe database operations
- **Schema Validation**: Zod schemas shared between frontend and backend for consistent data validation
- **Storage**: In-memory storage implementation with interface for easy database integration
- **Real-time Updates**: Server-sent events for live crawl progress updates

### Data Models
The application uses three main data entities:
- **CrawlJob**: Tracks crawling operations with status, progress, and configuration
- **CrawledImage**: Stores individual image discoveries with metadata and source information
- **User**: Basic user management structure (present but not actively used)

### API Design
RESTful API endpoints for:
- Creating and managing crawl jobs (`/api/crawl`)
- Retrieving crawl results and images (`/api/images`)
- Real-time progress monitoring via Server-Sent Events

### Development Setup
- **Build System**: ESBuild for server bundling, Vite for client bundling
- **Development**: Hot module replacement and live reloading
- **Type Safety**: Shared TypeScript types between client and server
- **Path Aliases**: Configured for clean imports (`@/`, `@shared/`)

## External Dependencies

### Database & Storage
- **Neon Database**: PostgreSQL-compatible serverless database using `@neondatabase/serverless`
- **Drizzle ORM**: Type-safe database operations with automatic migration support
- **Session Storage**: PostgreSQL-based session storage using `connect-pg-simple`

### Web Crawling & Automation
- **Puppeteer**: Headless Chrome automation for web page crawling and image extraction
- **Site Parsing**: Custom logic to extract images from `<img>` tags, `<picture>` elements, and CSS background images

### UI & Styling
- **Radix UI**: Comprehensive set of accessible UI primitives
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Lucide React**: Icon library for consistent iconography
- **shadcn/ui**: Pre-built component library built on Radix UI and Tailwind

### Development & Build Tools
- **Vite**: Fast build tool with HMR for development
- **ESBuild**: Fast JavaScript bundler for production builds
- **TypeScript**: Static type checking across the entire application
- **PostCSS**: CSS processing with Tailwind CSS and Autoprefixer

### Data Management
- **TanStack Query**: Server state management, caching, and synchronization
- **React Hook Form**: Form state management with validation
- **Zod**: Runtime type validation and schema definition
- **date-fns**: Date manipulation and formatting utilities