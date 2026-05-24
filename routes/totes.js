const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Totebag = mongoose.model('Totebag');
const Like = mongoose.model('Like');

// Mongoose's ValidationError has a .errors object whose keys are the field
// paths that failed. Surfacing those to the client lets the UI tell the user
// what was wrong without leaking internal stack traces.
function validationErrorBody(err) {
    if (err && err.name === 'ValidationError') {
        return {
            error: 'ValidationError',
            details: Object.keys(err.errors).reduce((acc, key) => {
                acc[key] = err.errors[key].message;
                return acc;
            }, {})
        };
    }
    if (err && err.name === 'StrictModeError') {
        return { error: 'UnknownField', details: err.message };
    }
    return null;
}

/* GET New tote page. */
router.get('/newtote', function (req, res) {
    res.render('newtote', { title: 'Create a Tote / Totebag Maker / Huge inc.' });
});

/* POST to createtote */
router.post('/createtote', async function (req, res) {
    try {
        // "Enter Sesame" admin escape hatch — original 2015 behavior preserved.
        if (
            req.body.textfields &&
            req.body.textfields.length === 1 &&
            req.body.textfields[0].text === 'Enter Sesame'
        ) {
            return res.send({ res: 'Success' });
        }

        // Strip server-managed / removed fields from the body. The 2015 client
        // still sends `likes: 0` here; without this, strict:'throw' would
        // reject the entire create because likes is no longer in the schema.
        const body = { ...req.body };
        delete body.likes;
        delete body.views;
        delete body.timestamp;
        delete body._id;
        delete body.__v;

        const newtote = new Totebag(body);
        await newtote.save();
        res.send({ res: 'Success', id: newtote._id });
    } catch (err) {
        const errBody = validationErrorBody(err);
        if (errBody) return res.status(400).json(errBody);
        console.error('[createtote] unexpected error:', err);
        res.status(500).json({ error: 'InternalServerError' });
    }
});

/* DELETE to deletetote */
router.get('/deletetote/:id', async function (req, res) {
    try {
        if (mongoose.isValidObjectId(req.params.id)) {
            await Totebag.findByIdAndDelete(req.params.id);
        }
        res.render('index', {
            title: 'Latest | Totebag Maker | Huge inc.',
            sort: 'latest'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json('Internal Server Error');
    }
});

/* UPDATE to updatetote
 *
 * Post Phase 3, likes are handled via /totes/:id/like, NOT this endpoint.
 * This route is essentially legacy — it still exists because the client
 * uses it for the view-count bump (which the server also ignores, since
 * Phase 2 strips `views` here too). Kept for safety / future use, but
 * narrowed: server-managed fields (likes/views/timestamp/_id/__v) are
 * stripped from the body so this route can never move any of them.
 */
router.put('/updatetote/:id', async function (req, res) {
    try {
        const update = { ...req.body };
        delete update.likes;
        delete update.views;
        delete update.timestamp;
        delete update._id;
        delete update.__v;

        await Totebag.findOneAndUpdate({ _id: req.params.id }, update, {
            runValidators: true,
            context: 'query'
        });
        res.send({ res: 'Success' });
    } catch (err) {
        const body = validationErrorBody(err);
        if (body) return res.status(400).json(body);
        console.error('[updatetote] unexpected error:', err);
        res.status(500).json({ error: 'InternalServerError' });
    }
});

/* POST /totes/:id/like  — idempotent: same browser liking twice no-ops.
 *
 * Uses req.bmUid (set by app.js middleware). Returns the current likeCount
 * so the client can sync if optimistic UI drifted.
 *
 * We deliberately do NOT increment Totebag.likes here — popular sorts use
 * the Like collection directly. Keeping a denormalized counter in sync is
 * a foot-gun (decrement-below-zero, atomicity vs the unique index) and the
 * new sort path doesn't need it.
 */
router.post('/:id/like', async function (req, res) {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'InvalidId' });
    }
    if (!req.bmUid) {
        return res.status(500).json({ error: 'MissingIdentity' });
    }

    try {
        const tote = await Totebag.findById(req.params.id, { _id: 1 });
        if (!tote) return res.status(404).json({ error: 'NotFound' });

        try {
            await Like.create({ toteId: tote._id, userCookie: req.bmUid });
        } catch (err) {
            // 11000 = duplicate key — already liked. That's the idempotent case.
            if (!(err && err.code === 11000)) throw err;
        }

        const likeCount = await Like.countDocuments({ toteId: tote._id });
        res.json({ liked: true, likeCount });
    } catch (err) {
        console.error('[POST /totes/:id/like] unexpected error:', err);
        res.status(500).json({ error: 'InternalServerError' });
    }
});

/* DELETE /totes/:id/like — idempotent: deleting a like that doesn't exist no-ops. */
router.delete('/:id/like', async function (req, res) {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'InvalidId' });
    }
    if (!req.bmUid) {
        return res.status(500).json({ error: 'MissingIdentity' });
    }

    try {
        const tote = await Totebag.findById(req.params.id, { _id: 1 });
        if (!tote) return res.status(404).json({ error: 'NotFound' });

        await Like.deleteOne({ toteId: tote._id, userCookie: req.bmUid });
        const likeCount = await Like.countDocuments({ toteId: tote._id });
        res.json({ liked: false, likeCount });
    } catch (err) {
        console.error('[DELETE /totes/:id/like] unexpected error:', err);
        res.status(500).json({ error: 'InternalServerError' });
    }
});

/* GET a single tote (view page) — falls through to home on invalid/missing id. */
router.get('/:id', async function (req, res) {
    const indexFallback = {
        title: 'Latest | Totebag Maker | Huge inc.',
        sort: 'latest'
    };
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.render('index', indexFallback);
        }
        const totebag = await Totebag.findById(req.params.id);
        if (!totebag) return res.render('index', indexFallback);

        res.render('index', {
            title: 'View Tote | Totebag Maker | Huge inc.',
            toteID: req.params.id,
            sort: 'latest'
        });
    } catch (err) {
        console.error(err);
        res.render('index', indexFallback);
    }
});

module.exports = router;
