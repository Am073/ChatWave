# Setup & Installation Guide — ChatWave

This guide walks you through setting up ChatWave locally using cloud-hosted MongoDB Atlas and Qdrant Cloud free tiers.

---

## 📋 Prerequisites

Ensure you have the following installed on your machine:
1.  **Node.js** (v20+ recommended)
2.  **MongoDB Atlas Connection URI** (or local MongoDB database)
3.  **Qdrant Cloud Cluster endpoint and API key** (Free tier available at qdrant.tech)
4.  **Tesseract OCR (for image extraction support):**
    *   **Ubuntu/Debian:** `sudo apt-get install tesseract-ocr libmagic1`
    *   **macOS:** `brew install tesseract libmagic`
    *   **Windows:** Download and install the Tesseract executable from the UB Mannheim project repository, and add its path to your system's Environment Variables.
5.  **Google Gemini API Key:** Obtain an API key from Google AI Studio.

---

## ⚙️ Environment Configuration

### 1. Backend Configuration
Navigate to the `backend/` directory, copy the example environment file, and edit it:
```bash
cd backend
cp .env.example .env
```
Update the `.env` file with your details:
*   `MONGO_URI`: Your MongoDB Atlas connection URI.
*   `JWT_SECRET`: Generate a secure random string (e.g., `openssl rand -hex 32`).
*   `JWT_REFRESH_SECRET`: Generate another secure random string.
*   `CSRF_SECRET`: Generate a secure random string.
*   `GEMINI_API_KEY`: Paste your Gemini API key here.
*   `GEMINI_MODEL`: Defaults to `gemini-2.0-flash`. Can be changed to `gemini-2.5-flash` or `gemini-3.5-flash`.
*   `QDRANT_URL`: Your Qdrant Cloud cluster URL (e.g., `https://xxxxxx.gcp.qdrant.io:6333`).
*   `QDRANT_API_KEY`: Your Qdrant Cloud cluster API key.

### 2. Frontend Configuration
Navigate to the `frontend/` directory, copy the example environment file, and edit it:
```bash
cd ../frontend
cp .env.example .env
```
Keep the default configurations or adjust host URLs if your server port is customized:
*   `VITE_API_BASE_URL`: `http://localhost:5000/api` (points to the Express backend).
*   `VITE_WS_URL`: `ws://localhost:5000/ws` (WebSocket connection url).

---

## 🗄️ Database Seeding

Seed the database with mock accounts for development (a student, a faculty member, and an institutional administrator):
```bash
cd ../backend
npm install
npm run seed
```

**Seeded Accounts for Testing:**

| Role | Username / College ID | Password | College Name | Department |
| :--- | :--- | :--- | :--- | :--- |
| **Student** | `CW-STUDENT` | `Password@123` | `ChatWave College` | `Computer Science` |
| **Faculty** | `CW-FACULTY` | `Password@123` | `ChatWave College` | `Computer Science` |
| **Admin** | `CW-ADMIN` | `Password@123` | `ChatWave College` | `N/A` |

---

## 🏃 Running the Application

### 1. Backend Server
From the `backend/` directory:
```bash
npm run dev
```
The backend server will bootstrap, establish connection pools, and start listening on port `5000`.

### 2. Frontend client
Open a new terminal session, navigate to the `frontend/` directory, and run:
```bash
npm install
npm run dev
```
The frontend client will start on `http://localhost:5173`. Open this URL in your web browser.
