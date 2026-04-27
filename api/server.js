// server.js — Express entry point
const express = require('express');
const path = require('path');
const app = express();

const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const bookingsRouter = require('./routes/bookings');
const featuresRouter = require('./routes/features');

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Serve frontend static files ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/features', featuresRouter);

// ── Root → Login page ───────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(3000, () => {
    console.log('🚀  Server running on http://localhost:3000');
});
