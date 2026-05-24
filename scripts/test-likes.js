#!/usr/bin/env node
// Phase 3 diagnostic — verifies the new Like collection + time-window
// popular aggregation works against your actual Atlas DB.
//
// Why this exists:
//   The Phase 3 popular query is implemented as a $lookup aggregation. In
//   our previous attempt the agent built it, claimed it worked from a local
//   sandbox, and you saw empty pages in the browser. We can't reliably run
//   Atlas binaries in the sandbox, so the real verification step is YOU
//   running this script against your real database and pasting the output.
//
// Usage:
//   node scripts/test-likes.js
//
// What it does (read-only by default — no writes to your DB):
//   1. Connects to MONGODB_URI from .env.
//   2. Counts existing totes and likes.
//   3. Runs the popular-by-window aggregation for each window
//      (day / week / month / year / all) and prints the first 5 results.
//   4. Reports collection names so we can catch the Mongoose-pluralization
//      class of bug (model 'Like' should map to collection 'likes').
//
// With --seed it also inserts 3 fake Like docs against the 3 newest totes
// so the aggregation actually has something to show. Safe to re-run — it
// uses unique fake bm_uid values so the upsert collisions don't matter.
// Use scripts/reset-likes.js to clean those up.

require('dotenv').config();
const mongoose = require('mongoose');
require('../models/Totebag');
require('../models/Like');

const Totebag = mongoose.model('Totebag');
const Like = mongoose.model('Like');

const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error('[!] MONGODB_URI not set. Check your .env file.');
    process.exit(1);
}

const shouldSeed = process.argv.includes('--seed');

const WINDOW_MS = {
    day: 1000 * 60 * 60 * 24,
    week: 1000 * 60 * 60 * 24 * 7,
    month: 1000 * 60 * 60 * 24 * 30,
    year: 1000 * 60 * 60 * 24 * 365,
    all: null
};

function cutoffFor(window) {
    const ms = WINDOW_MS[window];
    if (ms == null) return null;
    return new Date(Date.now() - ms);
}

// This is the same pipeline the route will use. Keep them in sync.
function popularPipeline(window, page = 0, limit = 24) {
    const cutoff = cutoffFor(window);
    const likeMatch = cutoff ? { $expr: { $eq: ['$toteId', '$$toteId'] }, createdAt: { $gte: cutoff } }
                             : { $expr: { $eq: ['$toteId', '$$toteId'] } };

    return [
        {
            $lookup: {
                from: 'likes',
                let: { toteId: '$_id' },
                pipeline: [{ $match: likeMatch }, { $count: 'n' }],
                as: '_likeWindow'
            }
        },
        {
            $addFields: {
                windowLikes: {
                    $ifNull: [{ $arrayElemAt: ['$_likeWindow.n', 0] }, 0]
                }
            }
        },
        { $project: { _likeWindow: 0 } },
        // Include 0-likes totes in the result; tiebreak by recency.
        { $sort: { windowLikes: -1, _id: -1 } },
        { $skip: page * limit },
        { $limit: limit }
    ];
}

async function main() {
    await mongoose.connect(uri);
    console.log('[mongo] connected\n');

    // Sanity-check collection names — Mongoose pluralizes 'Like' to 'likes'.
    // If anything is misnamed the $lookup silently returns nothing.
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections in this DB:', collections.map((c) => c.name).join(', '));
    console.log(`Totebag model -> collection: ${Totebag.collection.name}`);
    console.log(`Like    model -> collection: ${Like.collection.name}`);
    console.log('(Aggregation $lookup uses "from: \'likes\'" — these should match.)\n');

    const toteCount = await Totebag.countDocuments();
    const likeCount = await Like.countDocuments();
    console.log(`Totes in DB: ${toteCount}`);
    console.log(`Likes in DB: ${likeCount}\n`);

    if (shouldSeed) {
        if (toteCount === 0) {
            console.log('[seed] No totes to like — skipping seed.');
        } else {
            const recent = await Totebag.find({}, { _id: 1 })
                .sort({ timestamp: -1 })
                .limit(3)
                .lean();
            // Use distinct cookie ids per seeded like so duplicate-key doesn't fire.
            const seedDocs = recent.flatMap((t, i) => [
                { toteId: t._id, userCookie: `test-uid-${i}-a-${Date.now()}` },
                { toteId: t._id, userCookie: `test-uid-${i}-b-${Date.now()}` }
            ]);
            try {
                await Like.insertMany(seedDocs);
                console.log(`[seed] Inserted ${seedDocs.length} test Like docs against ${recent.length} totes.\n`);
            } catch (err) {
                console.log(`[seed] insertMany error: ${err.message}\n`);
            }
        }
    }

    for (const window of ['day', 'week', 'month', 'year', 'all']) {
        const pipeline = popularPipeline(window, 0, 5);
        const results = await Totebag.aggregate(pipeline);
        console.log(`=== window=${window} (top 5) ===`);
        if (results.length === 0) {
            console.log('  (no totes returned — this is suspicious unless DB is empty)');
        } else {
            for (const t of results) {
                const preview = (t.textfields && t.textfields[0] && t.textfields[0].text) || '(no text)';
                console.log(
                    `  windowLikes=${t.windowLikes}  ${String(t._id)}  ${JSON.stringify(preview).slice(0, 40)}`
                );
            }
        }
        console.log('');
    }

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
});
