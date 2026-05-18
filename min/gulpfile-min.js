function errorHandler(e) {
    (console.log(e.toString()), this.emit('end'));
}
var gulp = require('gulp'),
    sass = require('gulp-ruby-sass'),
    autoprefixer = require('gulp-autoprefixer'),
    minifycss = require('gulp-minify-css'),
    jshint = require('gulp-jshint'),
    uglify = require('gulp-uglify'),
    jade = require('gulp-jade'),
    imagemin = require('gulp-imagemin'),
    rename = require('gulp-rename'),
    concat = require('gulp-concat'),
    notify = require('gulp-notify'),
    cache = require('gulp-cache'),
    livereload = require('gulp-livereload'),
    del = require('del');
(gulp.task('styles', function () {
    return gulp
        .src('public/stylesheets/scss/style.scss')
        .pipe(sass({ style: 'expanded' }))
        .on('error', errorHandler)
        .on('error', function (e) {
            console.log(e.message);
        })
        .pipe(
            autoprefixer(
                'last 2 version',
                'safari 5',
                'ie 8',
                'ie 9',
                'opera 12.1',
                'ios 6',
                'android 4'
            )
        )
        .pipe(gulp.dest('public/stylesheets/'))
        .pipe(rename({ suffix: '.min' }))
        .pipe(minifycss())
        .pipe(gulp.dest('public/stylesheets/min/'))
        .pipe(notify({ message: 'Styles task complete' }));
}),
    gulp.task('scripts', function () {
        return gulp
            .src('public/javascripts/*.js')
            .pipe(jshint('.jshintrc'))
            .pipe(jshint.reporter('default'))
            .pipe(rename({ suffix: '.min' }))
            .pipe(uglify())
            .on('error', errorHandler)
            .pipe(gulp.dest('public/javascripts/min'))
            .pipe(notify({ message: 'Scripts task complete' }));
    }),
    gulp.task('images', function () {
        return gulp
            .src('public/images/*')
            .pipe(imagemin({ optimizationLevel: 5, progressive: !0, interlaced: !0 }))
            .pipe(gulp.dest('public/images/compressed/'))
            .pipe(notify({ message: 'Images task complete' }));
    }),
    gulp.task('clean', function (e) {
        del(['public/stylesheets', 'public/javascripts', 'public/images'], e);
    }),
    gulp.task('default', ['clean'], function () {
        gulp.start('styles', 'scripts');
    }),
    gulp.task('watch', function () {
        (gulp.watch('public/stylesheets/**/*.scss', ['styles']),
            gulp.watch('public/javascripts/**/*.js', ['scripts']),
            livereload.listen(),
            gulp.watch(['public/**/*']).on('change', livereload.changed));
    }));
