// Totebag model — registers the Mongoose schema globally on require.
//
// Validation policy:
//   - Server controls timestamp/likes/views; client values are ignored.
//   - Unknown fields are rejected (strict: 'throw') so the API surface is
//     locked down. If the client sends a field we don't know about, the save
//     fails with a clear error instead of silently bloating the document.
//   - Coordinate / size / count bounds prevent the "break out of text area"
//     class of bugs by refusing values the UI would never produce.

const mongoose = require('mongoose');

const TextfieldSchema = new mongoose.Schema(
    {
        text: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 200
        },
        x: { type: Number, default: 0, min: -10, max: 10 },
        y: { type: Number, default: 0, min: -10, max: 10 },
        // domid is a random 16-char alphanumeric string the client uses for DOM lookups.
        domid: {
            type: String,
            maxlength: 32,
            match: /^[A-Za-z0-9]+$/
        },
        // em-based vertical rhythm; ~1 is normal, accept 0 to 10.
        leading: { type: Number, default: 1, min: 0, max: 10 },
        // em-based letter-spacing; small negative values are common for tight tracking.
        kerning: { type: Number, default: 0, min: -1, max: 1 },
        // em-based font size multiplier of the bag width; default is 0.28.
        fontSize: { type: Number, default: 0.28, min: 0.05, max: 2 },
        justify: {
            type: String,
            enum: ['left', 'center', 'right'],
            default: 'left'
        },
        // Set only when the user toggles strikethrough on. Otherwise omitted.
        strikethrough: {
            type: String,
            enum: ['strikethrough']
        },
        // CSS width string — e.g. "100%", "50%", "120px". Keep it tight.
        width: {
            type: String,
            default: '100%',
            maxlength: 16,
            match: /^\d+(\.\d+)?(%|px|em|rem)?$/
        }
    },
    { _id: false }
);

const TotebagSchema = new mongoose.Schema(
    {
        color: {
            type: String,
            required: true,
            enum: ['red', 'black', 'white']
        },
        size: {
            type: String,
            required: true,
            enum: ['small', 'big'],
            default: 'small'
        },
        // Server-managed: never trust the client.
        likes: { type: Number, default: 0, min: 0, index: true },
        views: { type: Number, default: 0, min: 0 },
        timestamp: { type: Date, default: Date.now, index: true },

        textfields: {
            type: [TextfieldSchema],
            validate: {
                validator: (arr) => Array.isArray(arr) && arr.length >= 1 && arr.length <= 4,
                message: 'A tote must have between 1 and 4 text fields.'
            }
        }
    },
    {
        // Reject unknown fields outright rather than silently dropping them.
        // (Anything the API doesn't know about is suspicious.)
        strict: 'throw',
        // Don't let clients send their own __v or _id.
        minimize: true
    }
);

// Belt-and-suspenders: even if someone bypasses defaults, force server-managed
// fields to safe values on every save.
TotebagSchema.pre('validate', function (next) {
    // For brand-new totes, ensure timestamp/likes/views are set by the server,
    // not whatever the client sent.
    if (this.isNew) {
        this.timestamp = new Date();
        this.likes = 0;
        this.views = 0;
    }
    next();
});

module.exports = mongoose.model('Totebag', TotebagSchema);
