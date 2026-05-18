const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Totebag = mongoose.model('Totebag');

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

        const newtote = new Totebag(req.body);
        await newtote.save();
        res.send({ res: 'Success', id: newtote._id });
    } catch (err) {
        const body = validationErrorBody(err);
        if (body) return res.status(400).json(body);
        console.error('[createtote] unexpected error:', err);
        res.status(500).json({ error: 'InternalServerError' });
    }
});

/* DELETE to deletetote */
router.get('/deletetote/:id', async function (req, res) {
    try {
        await Totebag.findByIdAndDelete(req.params.id);
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
 * NOTE: this endpoint still lets a caller change any field on any tote,
 * which is a trust problem on its own — addressed in the Phase 3 likes
 * overhaul. For now, at least we run validators on update so the same
 * length/coordinate/enum rules apply.
 */
router.put('/updatetote/:id', async function (req, res) {
    try {
        // Strip server-managed fields from the incoming body so a malicious
        // client can't bump likes/views or rewrite the timestamp.
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

// Validate :id by ensuring the tote exists.
router.param('id', async function (req, res, next, id) {
    try {
        if (!mongoose.isValidObjectId(id)) {
            return res.render('index', {
                title: 'Latest | Totebag Maker | Huge inc.',
                sort: 'latest'
            });
        }
        const found = await Totebag.findById(id);
        if (!found) {
            return res.render('index', {
                title: 'Latest | Totebag Maker | Huge inc.',
                sort: 'latest'
            });
        }
        next();
    } catch (err) {
        next(err);
    }
});

/* GET a single tote */
router.get('/:id', async function (req, res) {
    try {
        const totebag = await Totebag.findById(req.params.id);
        if (!totebag) {
            return res.render('index', {
                title: 'Latest | Totebag Maker | Huge inc.',
                sort: 'latest'
            });
        }
        res.render('index', {
            title: 'View Tote | Totebag Maker | Huge inc.',
            toteID: req.params.id,
            sort: 'latest'
        });
    } catch (err) {
        console.error(err);
        res.render('index', {
            title: 'Latest | Totebag Maker | Huge inc.',
            sort: 'latest'
        });
    }
});

module.exports = router;
