var express = require('express'),
    path = require('path'),
    favicon = require('serve-favicon'),
    logger = require('morgan'),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/bagmaker');
var routes = require('./routes/index'),
    users = require('./routes/users'),
    totes = require('./routes/totes'),
    app = express();
(app.set('views', path.join(__dirname, 'views')),
    app.set('view engine', 'jade'),
    app.use(logger('dev')),
    app.use(bodyParser.json()),
    app.use(bodyParser.urlencoded({ extended: !1 })),
    app.use(cookieParser()),
    app.use(express['static'](path.join(__dirname, 'public'))),
    app.use('/', routes),
    app.use('/users', users),
    app.use('/totes', totes),
    app.use(function (e, r, s) {
        var o = new Error('Not Found');
        ((o.status = 404), s(o));
    }),
    'development' === app.get('env') &&
        app.use(function (e, r, s, o) {
            (s.status(e.status || 500), s.render('error', { message: e.message, error: e }));
        }),
    app.use(function (e, r, s, o) {
        (s.status(e.status || 500), s.render('error', { message: e.message, error: {} }));
    }),
    (module.exports = app));
