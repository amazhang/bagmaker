const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Totebag = mongoose.model('Totebag');

/* GET New tote page. */
router.get('/newtote', function (req, res) {
    res.render('newtote', { title: 'Create a Tote / Totebag Maker / Huge inc.' });
});

/* POST to createtote */
router.post('/createtote', async function (req, res) {
    try {
        // "Enter Sesame" admin escape hatch — original 2015 behavior preserved.
        if (req.body.textfields &&
            req.body.textfields.length === 1 &&
            req.body.textfields[0].text === 'Enter Sesame') {
            return res.send({ res: 'Success' });
        }

        const newtote = new Totebag(req.body);
        await newtote.save();
        res.send({ res: 'Success' });
    } catch (err) {
        console.error(err);
        res.status(500).json(err);
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

/* UPDATE to updatetote */
router.put('/updatetote/:id', async function (req, res) {
    try {
        await Totebag.findOneAndUpdate({ _id: req.params.id }, req.body);
        res.send({ res: 'Success' });
    } catch (err) {
        console.error(err);
        res.status(500).json('Internal Server Error');
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
