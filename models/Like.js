// Like model — one document per (tote, browser-cookie) pair.
//
// Why a dedicated collection (vs a counter on Totebag)?
//   - The 2015 design tracked likes client-side via a cookie listing tote IDs,
//     and pushed the count back to Mongo by PUTting the whole tote object.
//     That's how someone could lie about any tote's like count.
//   - With a real Like collection we can:
//       1. Make double-liking impossible (unique index on (toteId, userCookie)).
//       2. Sort by time-window popularity ($lookup with createdAt filter).
//       3. Tell the client "you've liked this tote" authoritatively, instead
//          of trusting whatever was in their cookie.
//
// userCookie is the value of bm_uid (a UUID set httpOnly by app.js). It's
// not a user — it's a browser. That's fine for a fun toy app; we don't have
// accounts.

const mongoose = require('mongoose');

const LikeSchema = new mongoose.Schema(
    {
        toteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Totebag',
            required: true
        },
        userCookie: {
            type: String,
            required: true,
            // bm_uid is a UUID (36 chars) but accept a generous range so we
            // don't lock ourselves into one identity scheme later.
            minlength: 8,
            maxlength: 64
        },
        createdAt: {
            type: Date,
            default: Date.now,
            index: true
        }
    },
    {
        strict: 'throw',
        minimize: true
    }
);

// (toteId, userCookie) must be unique — second like attempt by the same
// browser becomes a no-op (duplicate-key error we catch in the route).
LikeSchema.index({ toteId: 1, userCookie: 1 }, { unique: true });

// Speeds up the time-window aggregation: group by toteId within a recent
// createdAt range.
LikeSchema.index({ createdAt: -1, toteId: 1 });

module.exports = mongoose.model('Like', LikeSchema);
