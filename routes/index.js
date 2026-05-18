const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Totebag = mongoose.model('Totebag');

const sorts = ['latest', 'oldest', 'popular', 'views'];

function sortNameFor(sort) {
    if (sort === 'latest') return 'Latest';
    if (sort === 'oldest') return 'Oldest';
    if (sort === 'popular') return 'Popular';
    if (sort === 'views') return 'Most Views';
    return undefined;
}

function getSortAttributeNextFromSort(sort) {
    const sortAttribute = {};
    if (sort === 'latest') sortAttribute.timestamp = -1;
    else if (sort === 'oldest') sortAttribute.timestamp = 1;
    else if (sort === 'popular') {
        sortAttribute.likes = -1;
        sortAttribute._id = -1;
    } else if (sort === 'views') sortAttribute.views = -1;
    return sortAttribute;
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
        const skip = parseInt(req.params.index, 10) || 0;
        const sortAttribute = getSortAttributeNextFromSort(req.params.sort);
        const totebag = await Totebag.find({}, null, {
            skip: skip,
            limit: 1,
            sort: sortAttribute
        });
        res.status(200).json(totebag);
    } catch (err) {
        console.error(err);
        res.status(500).json('Internal Server Error');
    }
});

// return tote json with neighbour info based on sort + id.
router.get('/data/:sort/tote/:id', async function (req, res, next) {
    try {
        const id = req.params.id;
        const sortAttribute = getSortAttributeNextFromSort(req.params.sort);
        const totebags = await Totebag.find({}, null, { sort: sortAttribute });

        for (let i = 0; i < totebags.length; i++) {
            if (String(totebags[i]._id) === id) {
                const clone = JSON.parse(JSON.stringify(totebags[i]));
                const prevIndex = i - 1 < 0 ? totebags.length - 1 : i - 1;
                const nextIndex = i + 1 >= totebags.length ? 0 : i + 1;
                clone.index = i;
                clone.nextIndex = nextIndex;
                clone.prevIndex = prevIndex;
                clone.totalBags = totebags.length;
                return res.status(200).json(clone);
            }
        }
        res.status(404).json('Not found');
    } catch (err) {
        console.error(err);
        res.status(500).json('Internal Server Error');
    }
});

// get a single bag's json
router.get('/data/tote/:id', async function (req, res, next) {
    try {
        const totebag = await Totebag.findById(req.params.id);
        res.status(200).json(totebag);
    } catch (err) {
        console.error(err);
        res.status(500).json('Internal Server Error');
    }
});

/* Paginated JSON list for a sort. */
router.get('/data/:sort/page/:page', async function (req, res, next) {
    try {
        const page = (parseInt(req.params.page, 10) || 1) - 1;
        const loadSize = 24;
        const sortAttribute = getSortAttributeNextFromSort(req.params.sort);
        const totebags = await Totebag.find({}, null, {
            skip: page * loadSize,
            limit: loadSize,
            sort: sortAttribute
        });
        res.status(200).json(totebags);
    } catch (err) {
        console.error(err);
        res.status(500).json('Internal Server Error');
    }
});

module.exports = router;
