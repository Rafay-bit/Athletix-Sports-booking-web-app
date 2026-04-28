# Athletix Sports Facility Booking System

Athletix is a comprehensive web-based platform for booking and managing sports facilities. It features a modern, neon-accented UI and a robust Node.js/Express backend integrated with an MS SQL Server database.

## Features

*   **Interactive Booking:** Users can browse available sports facilities and book them for specific time slots.
*   **User Dashboard:** A seamless, dynamic dashboard for managing bookings.
*   **Live Auctions:** A bidding system for exclusive time slots or facilities.
*   **Modern Aesthetics:** A premium, dynamic sports-themed design inspired by neon accents and modern web aesthetics.

## Tech Stack

*   **Frontend:** HTML, CSS (Vanilla), JavaScript, Tailwind CSS (for UI mockups)
*   **Backend:** Node.js, Express.js
*   **Database:** Microsoft SQL Server (mssql)

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd "db proj"
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Database Configuration:**
    *   Ensure you have MS SQL Server running.
    *   Execute the `SportsFacilityDB.sql` script to set up the schema and initial data.
    *   Configure your `.env` or `server.js` database connection strings as needed.

4.  **Run the Server:**
    ```bash
    node server.js
    ```
    The server will start, typically on port 3000.

## Project Structure

*   `api/`: Contains frontend public assets (`public/`) and backend routes (`routes/`).
*   `server.js`: The main Express server file handling API endpoints and database connections.
*   `SportsFacilityDB.sql`: The primary database schema and stored procedures.
*   `athletix_landing_claude.html`: The newly revamped landing page design.
