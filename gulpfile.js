// Build pipeline — Gulp 5 + dart-sass.
// What this builds:
//   public/stylesheets/scss/style.scss  ->  public/stylesheets/min/style.min.css
//   public/javascripts/*.js             ->  public/javascripts/min/*.min.js
// The Express server (app.js) references these min/* files in the Pug layout.

const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const autoprefixer = require('gulp-autoprefixer');
const cleanCSS = require('gulp-clean-css');
const uglify = require('gulp-uglify');
const rename = require('gulp-rename');
const del = require('del');

// ---- styles -------------------------------------------------------------
function styles() {
    return gulp
        .src('public/stylesheets/scss/style.scss')
        .pipe(sass({ outputStyle: 'expanded' }).on('error', sass.logError))
        .pipe(autoprefixer())
        .pipe(gulp.dest('public/stylesheets/'))
        .pipe(rename({ suffix: '.min' }))
        .pipe(cleanCSS())
        .pipe(gulp.dest('public/stylesheets/min/'));
}

// ---- scripts ------------------------------------------------------------
function scripts() {
    return gulp
        .src('public/javascripts/*.js')
        .pipe(rename({ suffix: '.min' }))
        .pipe(uglify())
        .pipe(gulp.dest('public/javascripts/min/'));
}

// ---- clean --------------------------------------------------------------
function clean() {
    return del([
        'public/javascripts/min/**',
        'public/stylesheets/min/**',
        'public/stylesheets/style.css'
    ]);
}

// ---- watch --------------------------------------------------------------
function watch() {
    gulp.watch('public/stylesheets/scss/**/*.scss', styles);
    gulp.watch(['public/javascripts/*.js', '!public/javascripts/min/**'], scripts);
}

// ---- exported tasks -----------------------------------------------------
const build = gulp.series(clean, gulp.parallel(styles, scripts));

exports.styles = styles;
exports.scripts = scripts;
exports.clean = clean;
exports.watch = watch;
exports.build = build;
exports.default = build;
