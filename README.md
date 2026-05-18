# Bagmaker

A little web app built in 2015 as a tribute to Huge inc.'s annual employee tote bag.
Originally a MEAN-ish stack experiment; modernized in 2026 to run on current Node
and MongoDB Atlas.

The app lets you design totes (text + size + color), browse what other people made,
sort by latest / popular / most-viewed, and "like" totes you enjoy.

## Stack

- **Express 4** (Node) + **Mongoose 8** against **MongoDB Atlas**
- **Pug** templates (server-rendered)
- **jQuery / Underscore / GSAP / Hammer.js** on the client (yes, it's 2015 vibes)
- **Gulp 5** build pipeline: dart-sass for SCSS, uglify for JS

## Run locally

You need Node 18+ and a MongoDB connection string (either a local `mongod` or a
free Atlas cluster).

```bash
# 1. Install deps and build assets
npm install
npm run build

# 2. Set your DB connection
cp .env.example .env
# edit .env and put your MONGODB_URI in

# 3. Start the server
npm start
# -> http://localhost:3000

# Or for development with live rebuild + auto-restart:
npm run dev
```

## Set up MongoDB Atlas (free tier)

1. Go to https://www.mongodb.com/cloud/atlas and create an account.
2. Create a free shared cluster (M0). Pick the region closest to your Render region.
3. Database Access → Add User → username + password. Save these.
4. Network Access → Add IP Address → "Allow Access from Anywhere" (`0.0.0.0/0`).
   Render's IPs are dynamic, so you need this for the free tier.
5. Connect → Drivers → copy the connection string. It looks like:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/bagmaker?retryWrites=true&w=majority`
   Replace `USER` and `PASSWORD` with the credentials from step 3.
6. Put this string in your local `.env` as `MONGODB_URI=...` and also paste it
   into Render's dashboard (step 3 below).

## Deploy to Render

1. Push this repo to GitHub.
2. In the Render dashboard: **New + → Blueprint → connect your GitHub repo**.
   Render will detect `render.yaml` and create the service automatically.
3. Set the `MONGODB_URI` environment variable in the Render dashboard
   (Settings → Environment) — paste the Atlas connection string from above.
4. First deploy takes ~3–5 minutes. Subsequent deploys auto-trigger on every
   push to `master`.

**Cold starts:** the free tier spins down after 15 minutes of inactivity.
The first hit after that takes ~30 seconds to wake. If you want to avoid this,
upgrade to a paid plan (~$7/mo) or use a service like UptimeRobot to ping the
site every 10 minutes.

## Recovering the original tote data (optional)

The `data/` folder contains the original 2015 development database — totes that
existed before the app went offline. They're stored in MongoDB's old MMAPv1
format, which was removed in Mongo 4.2.

To recover them and push them into your Atlas database:

```bash
# Requires Docker and mongodb-database-tools (brew install mongodb-database-tools)
./scripts/restore-old-data.sh
```

You can also skip this step and start fresh — the app works fine with an empty
collection.

## Repo layout

```
app.js               Express app + Mongoose model
bin/www              Server entry point
routes/
  index.js           Page routes + JSON data endpoints
  totes.js           Tote CRUD
  users.js           Placeholder
views/*.pug          Server-rendered templates
public/
  javascripts/       Source JS (jQuery-era, hand-written)
    *.js             Source files
    libs/            Third-party libs (jQuery, GSAP, etc.)
    min/             Built/minified output (gulp build)
  stylesheets/
    scss/            Source SCSS
    min/             Built/minified output
  images/, fonts/    Static assets
gulpfile.js          Build pipeline
render.yaml          Render deployment config
scripts/
  restore-old-data.sh   Optional data migration helper
.env.example         Template for local secrets
```

## Branch history

- `master` — original 2015–2017 codebase
- `modernize-2026` — modernized dependencies, async/await, Atlas-ready
- `flat_design`, `redesign-3` — old design iterations from the original era

## License

Personal portfolio project. Code is for demonstration purposes.
