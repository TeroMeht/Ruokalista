# 🌿 Viikkoruoka — Weekly Grocery Planner

A fullstack mobile-first PWA for managing your pantry, recipes, and shopping list.
Shared database means all family devices stay in sync in real time.

---

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | React 18 + Vite |
| Backend  | Node.js + Express |
| Database | PostgreSQL |
| Hosting  | Render / Railway / Fly.io (see below) |

---

## Local Development Setup

### 1. Prerequisites

- Node.js 18 or higher — https://nodejs.org
- PostgreSQL 14 or higher running locally
  - Mac: `brew install postgresql && brew services start postgresql`
  - Windows: https://www.postgresql.org/download/windows/
  - Linux: `sudo apt install postgresql && sudo service postgresql start`

### 2. Clone and install

```bash
cd viikkoruoka
npm install
cd server && npm install
cd ../client && npm install
cd ..
```

### 3. Create database

```bash
psql -U postgres -c "CREATE DATABASE viikkoruoka;"
```

### 4. Configure environment

```bash
cd server
cp .env.example .env
```

Open `server/.env` and set your DATABASE_URL:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/viikkoruoka
PORT=3001
NODE_ENV=development
JWT_SECRET=generate_a_long_random_string_here
```

### 5. Run migrations and seed data

```bash
cd server
npm run db:migrate   # creates all tables (fresh install — wipes data!)
npm run db:seed      # loads sample data (optional)
```

If you already have a v2 database with data you want to preserve, run the
in-place upgrade instead of `db:migrate`:

```bash
node src/db/migrate-v3.js   # adds 'Uncategorized' bucket, drops 'unchecked'
```

### 6. Start development servers

From the project root:

```bash
npm run dev
```

This starts:
- Backend API at http://localhost:3001
- React frontend at http://localhost:5173

Open http://localhost:5173 in your browser.

---

## Installing on Mobile (PWA)

After deployment (see below), open the URL in your phone browser:

**Android (Chrome):**
1. Open the app URL in Chrome
2. Tap the three-dot menu → "Add to Home Screen"
3. Tap "Install" — it appears as an app icon

**iPhone (Safari):**
1. Open the app URL in Safari
2. Tap the Share button (box with arrow)
3. Scroll down → "Add to Home Screen"
4. Tap "Add"

---

## Production Deployment

### Option A — Render (Recommended, free tier available)

Render hosts both the database and the app on one platform.

**Step 1: Create a PostgreSQL database on Render**
1. Go to https://render.com → New → PostgreSQL
2. Name it `viikkoruoka-db`, choose the free tier
3. Click "Create Database"
4. Copy the **External Database URL** — you'll need it in step 3

**Step 2: Push your code to GitHub**
```bash
cd viikkoruoka
git init
git add .
git commit -m "Initial commit"
# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/viikkoruoka.git
git push -u origin main
```

**Step 3: Create a Web Service on Render**
1. Render → New → Web Service → connect your GitHub repo
2. Set these:
   - **Root Directory:** (leave empty)
   - **Build Command:** `npm install && npm install --workspace=server && npm install --workspace=client && npm run build`
   - **Start Command:** `npm run start`
3. Add Environment Variables:
   - `DATABASE_URL` → paste the External URL from step 1
   - `NODE_ENV` → `production`
   - `JWT_SECRET` → (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `PORT` → `3001`
4. Click "Create Web Service"
5. Wait ~3 minutes for the first deploy

**Step 4: Run migrations on the deployed server**
In Render → your web service → Shell tab:
```bash
cd server && npm run db:migrate && npm run db:seed
```

Your app is live at `https://viikkoruoka.onrender.com` (or your custom URL).

---

### Option B — Railway (Simplest, $5/month)

```bash
npm install -g @railway/cli
railway login
railway new
railway add postgresql        # adds a free PostgreSQL instance
railway up                    # deploys everything
```

Railway auto-detects Node.js and sets DATABASE_URL automatically.
Run migrations from the Railway dashboard shell.

---

### Option C — Fly.io (Most control, good free tier)

```bash
npm install -g flyctl
flyctl auth login
flyctl launch                 # follow the prompts
flyctl postgres create --name viikkoruoka-db
flyctl postgres attach viikkoruoka-db
flyctl secrets set NODE_ENV=production JWT_SECRET=your_secret_here
flyctl deploy
# Then run migrations:
flyctl ssh console -C "cd server && npm run db:migrate"
```

---

### Option D — Self-hosted VPS (DigitalOcean, Hetzner, etc.)

For a €5/month Hetzner VPS or $6/month DigitalOcean droplet:

```bash
# On the server:
sudo apt update && sudo apt install -y nodejs npm postgresql nginx

# Set up PostgreSQL
sudo -u postgres createdb viikkoruoka
sudo -u postgres psql -c "CREATE USER viikko WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL ON DATABASE viikkoruoka TO viikko;"

# Clone and configure
git clone https://github.com/YOUR_USERNAME/viikkoruoka.git
cd viikkoruoka
npm install
cd server && cp .env.example .env
# Edit .env with your database credentials
npm run db:migrate
npm run db:seed

# Build frontend
cd ../client && npm run build

# Run with PM2
npm install -g pm2
pm2 start server/src/index.js --name viikkoruoka
pm2 save && pm2 startup

# Nginx config: /etc/nginx/sites-available/viikkoruoka
# server {
#   listen 80;
#   server_name your-domain.com;
#   location / { proxy_pass http://localhost:3001; }
# }
```

---

## Connecting a Different Database

The app works with any PostgreSQL-compatible database:

| Provider | Connection string format |
|----------|--------------------------|
| Supabase | `postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres` |
| Neon     | `postgresql://[user]:[password]@[host]/[dbname]?sslmode=require` |
| PlanetScale| Not supported (MySQL) |
| Aiven    | `postgresql://[user]:[password]@[host]:5432/defaultdb?sslmode=require` |

Just paste the connection string into your `DATABASE_URL` environment variable.

---

## Project Structure

```
viikkoruoka/
├── package.json              # root — runs both dev servers
├── server/
│   ├── .env.example          # copy to .env and configure
│   ├── package.json
│   └── src/
│       ├── index.js          # Express entry point
│       ├── db/
│       │   ├── index.js      # PostgreSQL connection pool
│       │   ├── migrate.js    # run: npm run db:migrate
│       │   └── seed.js       # run: npm run db:seed
│       └── routes/
│           ├── pantry.js     # GET/POST/PATCH/DELETE pantry
│           ├── recipes.js    # GET/POST/PUT/DELETE recipes
│           └── shopping.js   # GET computed shopping list
└── client/
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx           # root component, data fetching
        ├── index.css         # global styles + design tokens
        ├── lib/api.js        # all API calls in one place
        ├── hooks/useToast.js
        ├── components/
        │   ├── Header.jsx
        │   ├── TabBar.jsx    # fixed mobile nav (3 tabs)
        │   └── Modal.jsx
        └── pages/
            ├── PantryScreen.jsx
            ├── RecipesScreen.jsx
            └── ShopScreen.jsx
```

---

## API Reference

```
GET    /api/pantry/categories         — all categories + items
POST   /api/pantry/categories         — create category { name }
PATCH  /api/pantry/categories/:id     — rename category { name }
DELETE /api/pantry/categories/:id     — delete category + its items
                                         (recipe-linked items move to "Uncategorized")

POST   /api/pantry/items              — add item { category_id*, name, qty, status }   *required
PATCH  /api/pantry/items/:id          — update { status?, name?, qty?, category_id? }
DELETE /api/pantry/items/:id          — remove item

   status is 'have' or 'need'. Every item must belong to a category.

GET    /api/recipes                   — all recipes + ingredients
POST   /api/recipes                   — create recipe
PUT    /api/recipes/:id               — replace recipe
DELETE /api/recipes/:id               — remove recipe

GET    /api/shopping                  — computed: pantry needs + recipe gaps
GET    /api/health                    — server status check
```
