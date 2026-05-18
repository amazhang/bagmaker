// Load env vars from .env in development (Render injects them at runtime).
require('dotenv').config();

const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

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

// ---- Mongoose model -----------------------------------------------------
// Registered here so it's available to any router that does
// mongoose.model('Totebag') later.
const Totebag = mongoose.model(
    'Totebag',
    new mongoose.Schema({
        color: String,
        likes: { type: [Number], index: true },
        views: Number,
        size: String,
        timestamp: { type: [Date], index: true },
        textfields: [
            {
                text: String,
                x: Number,
                y: Number,
                domid: String,
                leading: Number,
                kerning: Number,
                fontSize: Number,
                justify: String,
                strikethrough: String,
                width: String
            }
        ]
    })
);

Totebag.schema.path('color').validate(function (value) {
    return /red|black|white/i.test(value);
}, 'Invalid color');

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
// body-parser is now built into express (since 4.16).
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
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
