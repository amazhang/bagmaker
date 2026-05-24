#!/usr/bin/env node
// Phase 3 cutover — wipes the slate clean.
//
// You picked "wipe the slate" for the Phase 3 likes overhaul, which means
// the legacy Totebag.likes field is removed entirely from every tote and the
// new Like collection starts empty. Run this ONCE when you're ready to flip
// the new like system on in production.
//
// Usage:
//   node scripts/reset-likes.js          # asks for confirmation
//   node scripts/reset-likes.js --yes    # skip confirmation (for CI/scripts)
//
// What it does:
//   1. $unsets `likes` on every tote that still has one (the field has been
//      removed from the schema — this scrubs the old data from disk too).
//   2. Drops the `likes` collection (Like docs created in dev/testing).
//
// What it does NOT do:
//   - Touch totebag textfields/color/size/views/timestamp.
//   - Touch bm_uid cookies (those just get re-used; harmless).

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error('[!] MONGODB_URI not set. Check your .env file.');
    process.exit(1);
}

const skipConfirm = process.argv.includes('--yes') || process.argv.includes('-y');

async function main() {
    await mongoose.connect(uri);

    // Use loose schemas so we operate at the collection level regardless of
    // what the production models currently look like.
    const Totebag = mongoose.model(
        '_ResetTote',
        new mongoose.Schema({}, { strict: false, collection: 'totebags' })
    );

    const totesWithLikesField = await Totebag.countDocuments({ likes: { $exists: true } });
    const likesCollExists = (await mongoose.connection.db.listCollections({ name: 'likes' }).toArray())
        .length > 0;
    const likesCount = likesCollExists
        ? await mongoose.connection.db.collection('likes').countDocuments()
        : 0;

    console.log(`Totes still carrying a 'likes' field: ${totesWithLikesField}`);
    console.log(`Documents in 'likes' collection: ${likesCount}`);

    if (totesWithLikesField === 0 && likesCount === 0) {
        console.log('Nothing to reset — slate is already clean.');
        await mongoose.disconnect();
        return;
    }

    if (!skipConfirm) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise((resolve) => {
            rl.question(
                `\n$unset likes on ${totesWithLikesField} totes and drop ${likesCount} Like docs?\nType "yes" to confirm: `,
                resolve
            );
        });
        rl.close();
        if (answer.trim().toLowerCase() !== 'yes') {
            console.log('Cancelled.');
            await mongoose.disconnect();
            return;
        }
    }

    const updateResult = await Totebag.updateMany(
        { likes: { $exists: true } },
        { $unset: { likes: '' } }
    );
    console.log(`Removed 'likes' field from ${updateResult.modifiedCount} totes.`);

    if (likesCollExists) {
        await mongoose.connection.db.collection('likes').drop();
        console.log("Dropped 'likes' collection.");
    }

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
