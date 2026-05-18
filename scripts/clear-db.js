#!/usr/bin/env node
// Wipe all totes from the database. Useful for dev/test cleanup.
//
// Usage:
//   node scripts/clear-db.js          # asks for confirmation
//   node scripts/clear-db.js --yes    # skip confirmation
//
// Reads MONGODB_URI from your .env file, so it talks to whatever database
// your app is currently configured against (probably your Atlas dev cluster).

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
    const Totebag = mongoose.model(
        'Totebag',
        new mongoose.Schema({}, { strict: false, collection: 'totebags' })
    );

    const count = await Totebag.countDocuments();
    console.log(`Currently ${count} tote${count === 1 ? '' : 's'} in the database.`);

    if (count === 0) {
        console.log('Nothing to delete.');
        await mongoose.disconnect();
        return;
    }

    if (!skipConfirm) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise((resolve) => {
            rl.question(`Delete all ${count} totes? Type "yes" to confirm: `, resolve);
        });
        rl.close();
        if (answer.trim().toLowerCase() !== 'yes') {
            console.log('Cancelled.');
            await mongoose.disconnect();
            return;
        }
    }

    const result = await Totebag.deleteMany({});
    console.log(`Deleted ${result.deletedCount} tote${result.deletedCount === 1 ? '' : 's'}.`);
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
