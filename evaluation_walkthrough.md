# 🏆 Athletix Project Evaluation Walkthrough

This document summarizes the technical architecture and core database features of the **Athletix Sports Booking & Auction System** for the evaluation.

---

## 🗄️ 1. Database Architecture (The Core)
The system uses **MS SQL Server** with a highly normalized schema consisting of **13 primary tables**, designed for transactional integrity and scalability.

### **Entity-Relationship Overview**
*   **Users & Memberships**: Users have roles (`student`, `staff`, `admin`) and tiered memberships (`Basic`, `Silver`, `Gold`, `Varsity`) that apply automatic discounts via SQL logic.
*   **Facilities & Slots**: Facilities are linked to reusable `timeslots`. A unique constraint `uc_facility_slot_date` prevents double-booking at the database level.
*   **Transactions**: Core transaction tables are `bookings`, `bids` (for auctions), and `payments`.
*   **Logistics**: `equipment` and `equipment_rentals` track inventory availability in real-time.

### **Advanced SQL Features**
The project implements **18 advanced features** grouped into 5 modules:
1.  **Automation**: `sp_get_available_facilities` uses a `CROSS JOIN` between facilities and slots, filtering out active bookings and maintenance.
2.  **Bidding Engine**: `view_active_auctions` uses aggregate functions (`MAX`) to track live leaderboards.
3.  **Financials**: `sp_calculate_discounted_price` dynamically computes prices based on membership tiers.
4.  **Inventory**: `view_equipment_availability` uses correlated subqueries to calculate `total_stock - sum(rented_qty)`.
5.  **Analytics**: Views for `peak_hours` and `power_users` provide admin insights.

---

## ⚡ 2. Core Modules & Business Logic

### **A. The Bidding Engine (Live Auctions)**
*   **Logic**: Facilities flagged as `is_hot` trigger the auction workflow.
*   **Validation**: Bids must be in multiples of **500** and must exceed the current highest bid.
*   **Finalization**: Auctions automatically close **6 hours prior** to the booking. The system identifies the winner, updates the booking status to `confirmed`, and sets the `finalprice` to the winning bid.

### **B. Real-Time Dashboard**
*   **Timers**: JavaScript-based countdowns on the frontend calculate time remaining until the auction close window.
*   **Leaderboard**: The dashboard uses a specialized SQL join (`OUTER APPLY`) to fetch the top bidder's name and amount instantly.

### **C. Equipment Rental Integration**
*   **Constraint**: Equipment can only be rented for **active bookings**.
*   **Persistence**: Rentals are saved to the `equipment_rentals` table and visible as sub-rows in the "My Bookings" table using dynamic data fetching.

---

## 🛠️ 3. Technical Stack
*   **Backend**: Node.js (Express)
*   **Database**: MS SQL Server (via `mssql` / `msnodesqlv8`)
*   **Frontend**: Modern Vanilla JS + CSS (Athletix Neon Design)
*   **Documentation**: Integrated Swagger UI (`/api-docs`) for interactive testing.

---

## 🎯 4. Key Talking Points for Evaluation
1.  **Data Integrity**: Mention the `unique constraint` on `(facilityid, slotid, bookingdate)` which is the "Golden Rule" that prevents double-booking.
2.  **Query Optimization**: Views like `view_active_auctions` simplify complex joins for the frontend, making the API response times faster.
3.  **Atomic Transactions**: Placing a bid and starting an auction are atomic operations that ensure the database state remains consistent even with multiple users.
4.  **Real-Time Feedback**: Point out the **Live Leaderboard** and **Auction Timers** as the most challenging yet rewarding technical features.

---

### **Quick Commands for Demo**
*   **Access UI**: `http://localhost:3000`
*   **Access API Docs**: `http://localhost:3000/api-docs`
*   **Default Login**: `ahmadraza` / `1234`
