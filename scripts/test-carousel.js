#!/usr/bin/env node
// Phase 4 diagnostic — verifies the new carousel index computation matches
// what the old "load every tote and find" implementation would have returned.
//
// Why: Phase 4 swapped the carousel endpoint from "load all totes, scan to
// find one" to "countDocuments with a sort-key cutoff" (for latest/oldest/
// views) and "aggregate _ids only" (for popular). The contract is identical
// — same index, same totalBags, same prev/nextIndex — but the implementation
// is very different, so we want to prove the two agree before trusting it.
//
// Usage:
//   node scripts/test-carousel.js
//
// What it does (read-only):
//   For each (sort, tote) pair, it computes the index two ways:
//     a) NEW: countDocuments / aggregation (the Phase 4 path)
//     b) OLD: load all totes sorted, find the tote's array index
//   And reports any disagreement. Should print "ALL MATCH" on a healthy DB.

require('dotenv').config();
const mongoose = require('mongoose');
require('../models/Totebag');
require('../models/Like');

const Totebag = mongoose.model('Totebag');

const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error('[!] MONGODB_URI not set. Check your .env file.');
    process.exit(1);
}

// Copied/inlined from routes/index.js so the test can run standalone.
const WINDOW_MS = {
    day: 1000 * 60 * 60 * 24,
    week: 1000 * 60 * 60 * 24 * 7,
    month: 1000 * 60 * 60 * 24 * 30,
    year: 1000 * 60 * 60 * 24 * 365,
    all: null
};
function cutoffFor(window) {
    const ms = WINDOW_MS[window];
    return ms == null ? null : new Date(Date.now() - ms);
}
function popularPipeline(window) {
    const cutoff = cutoffFor(window);
    const likeMatch = cutoff
        ? { $expr: { $eq: ['$toteId', '$$toteId'] }, createdAt: { $gte: cutoff } }
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
                windowLikes: { $ifNull: [{ $arrayElemAt: ['$_likeWindow.n', 0] }, 0] }
            }
        },
        { $project: { _likeWindow: 0 } },
        { $sort: { windowLikes: -1, _id: -1 } }
    ];
}
function sortAttrFor(sort) {
    if (sort === 'latest') return { timestamp: -1, _id: -1 };
    if (sort === 'oldest') return { timestamp: 1, _id: 1 };
    if (sort === 'views') return { views: -1, _id: -1 };
    return null;
}
function cutoffFilterFor(sort, found) {
    if (sort === 'latest') {
        return {
            $or: [
                { timestamp: { $gt: found.timestamp } },
                { timestamp: found.timestamp, _id: { $gt: found._id } }
            ]
        };
    }
    if (sort === 'oldest') {
        return {
            $or: [
                { timestamp: { $lt: found.timestamp } },
                { timestamp: found.timestamp, _id: { $lt: found._id } }
            ]
        };
    }
    if (sort === 'views') {
        return {
            $or: [
                { views: { $gt: found.views } },
                { views: found.views, _id: { $gt: found._id } }
            ]
        };
    }
    return null;
}

// NEW: O(log N) for sorted-field sorts, O(N) IDs-only for popular.
async function newIndex(sort, id, window) {
    const found = await Totebag.findById(id).lean();
    if (!found) return null;
    if (sort === 'popular') {
        const ranked = await Totebag.aggregate([
            ...popularPipeline(window || 'all'),
            { $project: { _id: 1 } }
        ]);
        return ranked.findIndex((t) => String(t._id) === id);
    }
    return await Totebag.countDocuments(cutoffFilterFor(sort, found));
}

// OLD: the original load-everything-and-scan approach.
async function oldIndex(sort, id, window) {
    let docs;
    if (sort === 'popular') {
        docs = await Totebag.aggregate(popularPipeline(window || 'all'));
    } else {
        docs = await Totebag.find({}, null, { sort: sortAttrFor(sort) }).lean();
    }
    for (let i = 0; i < docs.length; i++) {
        if (String(docs[i]._id) === id) return i;
    }
    return -1;
}

async function main() {
    await mongoose.connect(uri);
    console.log('[mongo] connected\n');

    const totes = await Totebag.find({}, { _id: 1 }).lean();
    const total = totes.length;
    console.log(`Total totes: ${total}`);

    if (total === 0) {
        console.log('No totes — nothing to test.');
        await mongoose.disconnect();
        return;
    }

    const sorts = ['latest', 'oldest', 'views', 'popular'];
    const windows = ['day', 'week', 'month', 'year', 'all'];

    let mismatches = 0;
    let checks = 0;

    for (const sort of sorts) {
        if (sort === 'popular') {
            for (const window of windows) {
                for (const t of totes) {
                    const idStr = String(t._id);
                    const nu = await newIndex(sort, idStr, window);
                    const ol = await oldIndex(sort, idStr, window);
                    checks++;
                    if (nu !== ol) {
                        mismatches++;
                        console.log(`  MISMATCH sort=${sort} window=${window} id=${idStr}: new=${nu} old=${ol}`);
                    }
                }
            }
        } else {
            for (const t of totes) {
                const idStr = String(t._id);
                const nu = await newIndex(sort, idStr);
                const ol = await oldIndex(sort, idStr);
                checks++;
                if (nu !== ol) {
                    mismatches++;
                    console.log(`  MISMATCH sort=${sort} id=${idStr}: new=${nu} old=${ol}`);
                }
            }
        }
    }

    console.log(`\nChecked ${checks} (sort, tote) pairs.`);
    if (mismatches === 0) {
        console.log('ALL MATCH — Phase 4 carousel endpoint is consistent with the legacy implementation.');
    } else {
        console.log(`${mismatches} MISMATCH(ES) — investigate before deploying.`);
        process.exitCode = 1;
    }

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
});
