# 🏗️ Athletix Project Structure & Skeleton

This document provides a clear map of the project files, their purposes, and how the overall "skeleton" of the Athletix system is organized.

---

## 📂 Project Directory Map

### **1. Core Backend (The Brain)**
*   **[server.js](file:///c:/Users/hp/Downloads/db%20proj/server.js)**
    *   **Purpose**: The central Node.js entry point.
    *   **Skeleton**: It initializes the Express server, connects to the SQL database using `mssql`, and defines all REST API endpoints. It also serves the `public/` directory and hosts the Swagger documentation.

### **2. Database Layer (The Memory)**
*   **[SportsFacilityDB.sql](file:///c:/Users/hp/Downloads/db%20proj/SportsFacilityDB.sql)**
    *   **Purpose**: The "Single Source of Truth" for the database.
    *   **Skeleton**: Contains the entire Schema (DML), including table definitions, Relationships (Foreign Keys), Stored Procedures (for business logic), and Views (for analytics).
*   **[DummyTesting.sql](file:///c:/Users/hp/Downloads/db%20proj/DummyTesting.sql)**
    *   **Purpose**: Sample data and testing scripts used to populate the database for demonstration.

### **3. Frontend Layer (The Face)**
Located inside the `public/` folder:
*   **[public/index.html](file:///c:/Users/hp/Downloads/db%20proj/public/index.html)**
    *   **Purpose**: The main Single Page Application (SPA).
    *   **Skeleton**: Houses both the Landing Page and the User Dashboard. It defines the structure of the UI components (modals, grids, tables).
*   **[public/css/style.css](file:///c:/Users/hp/Downloads/db%20proj/public/css/style.css)**
    *   **Purpose**: The "Athletix Neon" design system.
    *   **Skeleton**: Custom CSS tokens (variables) for colors, animations (fade-ins), and responsive layouts for the dashboard.
*   **[public/js/app.js](file:///c:/Users/hp/Downloads/db%20proj/public/js/app.js)**
    *   **Purpose**: The dynamic engine of the frontend.
    *   **Skeleton**: Manages all client-side state, handles API `fetch` requests, calculates real-time auction timers, and updates the DOM dynamically without page reloads.

### **4. Documentation & Configuration**
*   **[evaluation_walkthrough.md](file:///c:/Users/hp/Downloads/db%20proj/evaluation_walkthrough.md)**
    *   **Purpose**: A guide specifically prepared for the project evaluation.
*   **[package.json](file:///c:/Users/hp/Downloads/db%20proj/package.json)**
    *   **Purpose**: Manages Node.js dependencies (`express`, `mssql`, `swagger-jsdoc`, etc.).

---

## 🦴 The Project Skeleton (How it works together)

1.  **Request Flow**: When a user clicks "Place Bid" in the browser (`app.js`), it sends a POST request to `server.js`.
2.  **Processing**: `server.js` validates the bid and executes a query against the SQL database (`SportsFacilityDB.sql`).
3.  **Data Feedback**: The database returns the new highest bid. `server.js` sends this back as JSON.
4.  **UI Update**: `app.js` receives the JSON and updates the card's price and leader badge instantly using DOM manipulation.
5.  **Automation**: Background timers in `app.js` monitor the auction close time, calling a "finalize" endpoint in `server.js` when they hit zero.

---

## 🛠️ Utility Scripts (Internal Tools)
You may see several `.py` and `.js` scripts in the root (e.g., `rebuild_server.py`, `replace.py`). These are **automated utility tools** used during development to quickly update large sections of code or rebuild the server environment without manual typing errors.
