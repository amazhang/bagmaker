var express = require('express'),
    router = express.Router();
(router.get('/', function (e, t) {
    var o = e.db;
    o.collection('totebags')
        .find()
        .toArray(function (e, o) {
            t.json(o);
        });
}),
    router.get('/newtote', function (e, t) {
        t.render('newtote', { title: 'Design a Tote Bag' });
    }),
    router.post('/createtote', function (e, t) {
        var o = e.db;
        o.collection('totebags').insert(e.body, function (e, o) {
            t.send(null === e ? { msg: '' } : { msg: e });
        });
    }),
    router['delete']('/deletetote/:id', function (e, t) {
        var o = e.db,
            r = e.params.id;
        o.collection('totebags').removeById(r, function (e, o) {
            t.send(1 === o ? { msg: '' } : { msg: 'error: ' + e });
        });
    }),
    router.put('/updatetote/:id', function (e, t) {
        var o = e.db,
            r = e.params.id,
            n = { $set: e.body };
        o.collection('totebags').updateById(r, n, function (e, o) {
            t.send(1 === o ? { msg: '' } : { msg: 'error: ' + e });
        });
    }),
    router.get('/:id', function (e, t) {
        var o = e.db;
        o.collection('totebags').findOne({ bagNum: e.params.id }, function (e, o) {
            (e && t.send(e),
                t.render('index', { title: 'Check out this tote.', tote: JSON.stringify(o) }));
        });
    }),
    (module.exports = router));
