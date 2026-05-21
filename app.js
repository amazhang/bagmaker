// Load env vars from .env in development (Render injects them at runtime).
require('dotenv').config();

const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const crypto = require('crypto');

// ---- Database connection ------------------------------------------------
// MONGODB_URI must be set in the environment. Locally: in .env file.
// In production (Render): set it as an environment variable in the dashboard.
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bagmaker';

mongoose
    .connect(mongoUri)
    .then(() => console.log('[mongo] connected to', mongoUri.replace(/\/\/[^@]+@/, '//<creds>@')))
    .catch((err) => {
        console.error('[mongo] connection error:', err.message);
        // Don't crash — let the app boot so health checks pass; routes will error
        // until the DB is reachable.
    });

// ---- Mongoose models ----------------------------------------------------
// Registering by require() so any router using mongoose.model(...) continues
// to work. Schemas + validation live in models/.
require('./models/Totebag');
require('./models/Like');

// ---- Routers ------------------------------------------------------------
const routes = require('./routes/index');
const users = require('./routes/users');
const totes = require('./routes/totes');

const app = express();

// View engine — Jade was renamed to Pug; same syntax, new package name.
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Favicon — only mount if the file exists so a missing favicon doesn't crash boot.
const faviconPath = path.join(__dirname, 'public/images/favicon.png');
try {
    require('fs').accessSync(faviconPath);
    app.use(favicon(faviconPath));
} catch (e) {
    // no favicon, that's fine
}

app.use(logger('dev'));
// body-parser is now built into express (since 4.16). 20kb is plenty for a
// tote (typical payloads are <2kb); rejects oversized POSTs early so attackers
// can't make us parse megabytes of JSON.
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(cookieParser());

// ---- bm_uid cookie -----------------------------------------------------
// Server-set, httpOnly browser identity used by the likes system. We do not
// trust client-supplied identity for likes (the original 2015 design did,
// which is part of what Phase 3 is fixing). One UUID per browser, ~2y life.
//
// req.bmUid is set on EVERY request so downstream code can rely on it.
const TWO_YEARS_MS = 1000 * 60 * 60 * 24 * 365 * 2;
app.use(function (req, res, next) {
    let uid = req.cookies && req.cookies.bm_uid;
    if (!uid) {
        uid = crypto.randomUUID();
        res.cookie('bm_uid', uid, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: TWO_YEARS_MS,
            path: '/'
        });
    }
    req.bmUid = uid;
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);
app.use('/totes', totes);

// 404 handler — last because nothing else matched.
app.use(function (req, res, next) {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// Error handler — JSON in dev so we can see what happened.
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.json({
        message: err.message,
        // hide stack in production
        error: process.env.NODE_ENV === 'production' ? {} : err.stack
    });
});

module.exports = app;
