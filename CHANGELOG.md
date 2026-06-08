# 📜 Changelog

All notable changes to the ChatWave project will be documented in this file.

---

## [3.5.0] — 2026-03-24
### 🚀 Production Stabilization & Audit 
- **Documentation Overhaul**: Complete rewrite of README, SETUP, CHANGELOG, and ZERO to reflect production state.
- **Codebase Cleanup**: Removed redundant test scripts, junk folders, and temporary files.
- **RBAC Enforcement**: Finalized role-based access control for Student, Faculty, and Admin dashboards.
- **ESM Migration**: Standardized frontend configuration (Vite, Tailwind, PostCSS) to ECMAScript Modules (ESM).
- **Security Pruning**: Verified JWT token expiry and OAuth redirect logic.

---

## [3.0.0] — 2026-03-21
### ✨ The RAG Revolution
- **Core RAG Implementation**: Switched to a retrieval-augmented generation architecture using ChromaDB.
- **Multi-Format Ingestion**: Added support for PDF, Word, Excel, and Image extraction.
- **OCR Integration**: Implemented Tesseract OCR for processing scanned documents and images.
- **Dual Gemini Keys**: Added rotation logic for Gemini API keys to handle free-tier rate limits.
- **Chat Mode Toggle**: Introduced "College Mode" vs. "General Mode" for students.

---

## [2.5.0] — 2026-03-04
### 📅 Smart Calendar Integration
- **Google OAuth**: Connected Google Calendar for automated event syncing.
- **Auto-Detection**: Implemented date detection logic in chat to propose calendar events.
- **Settings Modal**: Redesigned account settings with integration and security sub-sections.
- **Database Schema Update**: Added `CalendarEvent` and `UserGoogleToken` tables with UUID casting fixes.

---

## [1.0.0] — 2024-02-03
### 🌱 Initial Launch
- **Foundation**: Basic FastAPI and React boilerplate.
- **Auth**: Simple JWT-based login and registration.
- **UI**: Prototype dashboard using Tailwind CSS.
- **Proof of Concept**: Basic Gemini chatbot integration.

---
*For historical changes, please refer to the Git commit history.*
