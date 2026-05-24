const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Totebag = mongoose.model('Totebag');
const Like = mongoose.model('Like');

const sorts = ['latest', 'oldest', 'popular', 'views'];

// Default window when ?window= isn't passed. Anthony picked all-time.
const DEFAULT_POPULAR_WINDOW = 'all';
const WINDOW_MS = {
    day: 1000 * 60 * 60 * 24,
    week: 1000 * 60 * 60 * 24 * 7,
    month: 1000 * 60 * 60 * 24 * 30,
    year: 1000 * 60 * 60 * 24 * 365,
    all: null
};

function normalizeWindow(w) {
    return Object.prototype.hasOwnProperty.call(WINDOW_MS, w) ? w : DEFAULT_POPULAR_WINDOW;
}

function cutoffFor(window) {
    const ms = WINDOW_MS[window];
    if (ms == null) return null;
    return new Date(Date.now() - ms);
}

function sortNameFor(sort) {
    if (sort === 'latest') return 'Latest';
    if (sort === 'oldest') return 'Oldest';
    if (sort === 'popular') return 'Popular';
    if (sort === 'views') return 'Most Views';
    return undefined;
}

// Used for the non-popular sorts. Popular goes through popularPipeline()
// below because it ranks by counted-likes-in-window rather than a stored
// field; we never fall through to this function with sort==='popular'.
//
// _id is included as a secondary sort key so the order is fully deterministic
// when the primary key ties — without it, two totes with identical timestamps
// could swap positions between requests, which would make Phase 4's index
// computation race against the page list endpoint.
function getSortAttributeNextFromSort(sort) {
    const sortAttribute = {};
    if (sort === 'latest') { sortAttribute.timestamp = -1; sortAttribute._id = -1; }
    else if (sort === 'oldest') { sortAttribute.timestamp = 1; sortAttribute._id = 1; }
    else if (sort === 'views') { sortAttribute.views = -1; sortAttribute._id = -1; }
    return sortAttribute;
}

/**
 * Popular pipeline — used wherever we need to rank by likes within a time
 * window. Returns ALL totes (even zero-like ones in the window), tiebreaking
 * by _id desc so 0-like totes fall back to newest-first ordering.
 *
 * Keep this in sync with scripts/test-likes.js if you change it.
 */
function popularPipeline(window, opts = {}) {
    const { skip = 0, limit = null, matchToteId = null } = opts;
    const cutoff = cutoffFor(window);
    const likeMatch = cutoff
        ? { $expr: { $eq: ['$toteId', '$$toteId'] }, createdAt: { $gte: cutoff } }
        : { $expr: { $eq: ['$toteId', '$$toteId'] } };

    const pipeline = [];
    if (matchToteId) pipeline.push({ $match: { _id: matchToteId } });
    pipeline.push(
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
        { $sort: { windowLikes: -1, _id: -1 } }
    );
    if (skip) pipeline.push({ $skip: skip });
    if (limit) pipeline.push({ $limit: limit });
    return pipeline;
}

/**
 * Given an array of (lean) tote objects, decorate each with:
 *   - likedByMe: whether the current bm_uid has a Like doc for this tote.
 *   - likeCount: actual count from the Like collection.
 *
 * Returns the same array (mutated). One query per page, batched by toteId.
 */
async function decorateLikes(totes, bmUid) {
    if (!totes || totes.length === 0) return totes;

    const ids = totes.map((t) => t._id);

    // Counts — group by toteId. Builds a map of id -> count.
    const counts = await Like.aggregate([
        { $match: { toteId: { $in: ids } } },
        { $group: { _id: '$toteId', n: { $sum: 1 } } }
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.n]));

    // Whether MY cookie liked any of these. Tiny query — at most 1 doc per tote.
    let likedSet = new Set();
    if (bmUid) {
        const mine = await Like.find(
            { toteId: { $in: ids }, userCookie: bmUid },
            { toteId: 1, _id: 0 }
        ).lean();
        likedSet = new Set(mine.map((m) => String(m.toteId)));
    }

    for (const t of totes) {
        const key = String(t._id);
        t.likeCount = countMap.get(key) || 0;
        t.likedByMe = likedSet.has(key);
    }
    return totes;
}

function handle404(req, res) {
    res.render('index', {
        title: 'Latest | Totebag Maker | Huge inc.',
        sort: 'latest'
    });
}

// ----- Page routes -------------------------------------------------------

/* GET home page. Default: latest */
router.get('/', function (req, res) {
    res.render('index', {
        title: 'Latest | Totebag Maker | Huge inc.',
        sort: 'latest'
    });
});

// Validate :sort
router.param('sort', function (req, res, next, sort) {
    if (sorts.indexOf(sort) === -1) {
        return handle404(req, res);
    }
    next();
});

// Validate :id by checking it exists in Mongo.
router.param('id', async function (req, res, next, id) {
    try {
        if (!mongoose.isValidObjectId(id)) return handle404(req, res);
        const found = await Totebag.findById(id);
        if (!found) return handle404(req, res);
        next();
    } catch (err) {
        next(err);
    }
});

router.get('/:sort', function (req, res) {
    const sort = req.params.sort;
    const sortName = sortNameFor(sort);
    if (!sortName) return handle404(req, res);
    res.render('index', {
        title: sortName + ' | Totebag Maker | Huge inc.',
        sort: sort
    });
});

router.get('/:sort/tote/:id', function (req, res) {
    const sort = req.params.sort;
    const id = req.params.id;
    const sortName = sortNameFor(sort);
    if (!sortName) return handle404(req, res);
    res.render('index', {
        title: 'View Tote | Totebag Maker | Huge inc.',
        toteID: id,
        sort: sort
    });
});

// ----- JSON data endpoints -----------------------------------------------

// return a single tote json based on sort and index (not id).
router.get('/data/:sort/:index', async function (req, res, next) {
    try {
        const sort = req.params.sort;
        const skip = parseInt(req.params.index, 10) || 0;
        let totebag;

        if (sort === 'popular') {
            const window = normalizeWindow(req.query.window);
            totebag = await Totebag.aggregate(popularPipeline(window, { skip, limit: 1 }));
        } else {
            const sortAttribute = getSortAttributeNextFromSort(sort);
            totebag = await Totebag.find({}, null, {
                skip: skip,
                limit: 1,
                sort: sortAttribute
            }).lean();
        }

        await decorateLikes(totebag, req.bmUid);
        res.status(200).json(totebag);
    } catch (err) {
        console.error(err);
        res.status(500).json('Internal Server Error');
    }
});

// Return tote json with neighbour info based on sort + id.
//
// Phase 4: no longer loads the whole collection. For latest/oldest/views the
// "index" of the requested tote is computed via countDocuments with a sort-
// key cutoff — O(log N) using the existing schema indexes on timestamp and
// (for views) a collection scan no worse than before. For popular we still
// have to evaluate the windowed aggregation across every tote to know X's
// rank, but we project only _id so the memory cost is ~24 bytes per tote
// instead of full documents.
router.get('/data/:sort/tote/:id', async function (req, res, next) {
    try {
        const sort = req.params.sort;
        const id = req.params.id;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(404).json('Not found');
        }

        const found = await Totebag.findById(id).lean();
        if (!found) return res.status(404).json('Not found');

        const totalBags = await Totebag.countDocuments({});
        if (totalBags === 0) return res.status(404).json('Not found');

        let index;
        if (sort === 'popular') {
            const window = normalizeWindow(req.query.window);
            // Same ranking pipeline as everywhere else, but we only need the
            // _id ordering — no textfields, no like decoration, just IDs.
            const ranked = await Totebag.aggregate([
                ...popularPipeline(window),
                { $project: { _id: 1 } }
            ]);
            index = ranked.findIndex((t) => String(t._id) === id);
            if (index === -1) return res.status(404).json('Not found');
        } else {
            // Compose the "comes before X" filter. With _id as deterministic
            // tiebreak, this exactly mirrors getSortAttributeNextFromSort().
            let cutoffFilter;
            if (sort === 'latest') {
                cutoffFilter = {
                    $or: [
                        { timestamp: { $gt: found.timestamp } },
                        { timestamp: found.timestamp, _id: { $gt: found._id } }
                    ]
                };
            } else if (sort === 'oldest') {
                cutoffFilter = {
                    $or: [
                        { timestamp: { $lt: found.timestamp } },
                        { timestamp: found.timestamp, _id: { $lt: found._id } }
                    ]
                };
            } else if (sort === 'views') {
                cutoffFilter = {
                    $or: [
                        { views: { $gt: found.views } },
                        { views: found.views, _id: { $gt: found._id } }
                    ]
                };
            } else {
                return res.status(400).json({ error: 'BadSort' });
            }
            index = await Totebag.countDocuments(cutoffFilter);
        }

        const prevIndex = index - 1 < 0 ? totalBags - 1 : index - 1;
        const nextIndex = index + 1 >= totalBags ? 0 : index + 1;
        found.index = index;
        found.nextIndex = nextIndex;
        found.prevIndex = prevIndex;
        found.totalBags = totalBags;
        await decorateLikes([found], req.bmUid);
        return res.status(200).json(found);
    } catch (err) {
        console.error(err);
        res.status(500).json('Internal Server Error');
    }
});

// get a single bag's json
router.get('/data/tote/:id', async function (req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'InvalidId' });
        }
        const totebag = await Totebag.findById(req.params.id).lean();
        if (!totebag) return res.status(404).json({ error: 'NotFound' });
        await decorateLikes([totebag], req.bmUid);
        res.status(200).json(totebag);
    } catch (err) {
        console.error(err);
        res.status(500).json('Internal Server Error');
    }
});

/* Paginated JSON list for a sort. */
// loadSize must match the client's browse.numPerPage so the pagination
// boundaries align between front-end and back-end. Divisible by 12 to keep
// rows complete at 2/3/4-column layouts.
router.get('/data/:sort/page/:page', async function (req, res, next) {
    try {
        const sort = req.params.sort;
        const page = (parseInt(req.params.page, 10) || 1) - 1;
        const loadSize = 36;
        let totebags;

        if (sort === 'popular') {
            const window = normalizeWindow(req.query.window);
            totebags = await Totebag.aggregate(
                popularPipeline(window, { skip: page * loadSize, limit: loadSize })
            );
        } else {
            const sortAttribute = getSortAttributeNextFromSort(sort);
            totebags = await Totebag.find({}, null, {
                skip: page * loadSize,
                limit: loadSize,
                sort: sortAttribute
            }).lean();
        }

        await decorateLikes(totebags, req.bmUid);
        res.status(200).json(totebags);
    } catch (err) {
        console.error(err);
        res.status(500).json('Internal Server Error');
    }
});

module.exports = router;
