# MyAIDoctor.io — Build & Deployment Guide (Ubuntu 24.04 LTS)

Complete instructions to build and run the MyAIDoctor.io platform from source on a fresh Ubuntu 24.04 LTS server.

---

## Prerequisites

A fresh Ubuntu 24.04 LTS installation (server or desktop) with sudo access and internet connectivity. Minimum recommended specs: 2 CPU cores, 4 GB RAM, 20 GB disk.

---

## Step 1 — System Update

```bash
sudo apt update && sudo apt upgrade -y
```

## Step 2 — Install Node.js 20 LTS

```bash
# Install Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version    # Should show v20.x.x
npm --version     # Should show 10.x.x
```

## Step 3 — Install PostgreSQL 16

```bash
# Add PostgreSQL Apt Repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install -y postgresql-16 postgresql-contrib-16

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify
sudo systemctl status postgresql
psql --version    # Should show psql (PostgreSQL) 16.x
```

## Step 4 — Create the Database and User

```bash
# Switch to the postgres system user
sudo -u postgres psql

# Inside the psql shell, run:
CREATE USER myaidoctor WITH PASSWORD 'myaidoctor_pass';
CREATE DATABASE myaidoctor_db OWNER myaidoctor;
GRANT ALL PRIVILEGES ON DATABASE myaidoctor_db TO myaidoctor;
\q
```

To verify the connection:

```bash
psql -U myaidoctor -d myaidoctor_db -h localhost -W
# Enter password: myaidoctor_pass
# You should see the myaidoctor_db=# prompt. Type \q to exit.
```

If you get a peer authentication error, edit pg_hba.conf:

```bash
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

Find the line for local connections and change `peer` to `md5`:

```
# IPv4 local connections:
host    all    all    127.0.0.1/32    md5
```

Then restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

## Step 5 — Install Build Essentials

```bash
sudo apt install -y build-essential git curl wget
```

## Step 6 — Clone or Copy the Project

If you have the project as a zip archive:

```bash
mkdir -p ~/projects
cd ~/projects
unzip myaidoctor.zip
cd myaidoctor
```

Or if using git:

```bash
cd ~/projects
git clone <your-repo-url> myaidoctor
cd myaidoctor
```

## Step 7 — Configure Environment Variables

The project includes a `.env` file. Verify or update it:

```bash
cat .env
```

It should contain:

```env
DATABASE_URL="postgresql://myaidoctor:myaidoctor_pass@localhost:5432/myaidoctor_db"
NEXTAUTH_SECRET="myaidoctor-dev-secret-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

For production, generate a proper secret:

```bash
openssl rand -base64 32
```

And update NEXTAUTH_SECRET and NEXTAUTH_URL accordingly.

## Step 8 — Install Node.js Dependencies

```bash
npm install
```

This installs all packages defined in `package.json`: Next.js 14, React 18, Prisma, Tailwind CSS, Recharts, Lucide React, date-fns, and bcryptjs.

## Step 9 — Generate Prisma Client and Run Migrations

```bash
# Generate the Prisma client from the schema
npx prisma generate

# Create the database tables
npx prisma db push

# Verify tables were created
npx prisma studio
# Opens a browser UI at http://localhost:5555 — you should see all tables (empty).
# Press Ctrl+C to close Prisma Studio.
```

## Step 10 — Seed the Database

```bash
node scripts/seed.js
```

Expected output:

```
Seeding MyAIDoctor database...
Created 3 clinics
Created 7 users
Created 10 patients
Created 14 appointments
Created 5 pre-visit briefs
Created 8 voice calls
Created 5 clinical protocols
Created audit log entries
Seeding completed successfully!
```

To verify seed data:

```bash
npx prisma studio
# Browse patients, appointments, pre-visit briefs, voice calls, etc.
```

## Step 11 — Run the Development Server

```bash
npm run dev
```

The application starts at **http://localhost:3000**. Open it in your browser.

Default navigation:
- **Dashboard** — `/dashboard` — overview stats, today's schedule, recent activity
- **Patients** — `/patients` — searchable patient registry
- **Appointments** — `/appointments` — date-filtered appointment view
- **Pre-Visit Briefs** — `/pre-visit` — AI-generated clinical briefs with SOAP notes
- **Voice Calls** — `/voice-calls` — call logs with transcripts
- **Settings** — `/settings` — system configuration panels

## Step 12 — Build for Production

```bash
# Create optimized production build
npm run build

# Start the production server
npm start
```

The production server runs at **http://localhost:3000** by default.

---

## Production Deployment (Optional)

### Using PM2 Process Manager

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the app with PM2
pm2 start npm --name "myaidoctor" -- start

# Save the process list so it restarts on reboot
pm2 save
pm2 startup
# Follow the printed command (copy/paste and run it)
```

### Nginx Reverse Proxy

```bash
sudo apt install -y nginx

sudo tee /etc/nginx/sites-available/myaidoctor << 'NGINX'
server {
    listen 80;
    server_name myaidoctor.io www.myaidoctor.io;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

sudo ln -s /etc/nginx/sites-available/myaidoctor /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### SSL with Let's Encrypt (for production domains)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d myaidoctor.io -d www.myaidoctor.io
# Follow the prompts to set up auto-renewing SSL certificates
```

### Firewall Configuration

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## Default Login Credentials (Seed Data)

All seeded users share the password: **MyAIDoc2024!**

| Email                              | Role       | Name              |
|------------------------------------|------------|-------------------|
| dr.chen@myaidoctor.io              | PROVIDER   | Dr. Sarah Chen    |
| dr.patel@myaidoctor.io             | PROVIDER   | Dr. Raj Patel     |
| dr.williams@myaidoctor.io          | PROVIDER   | Dr. Maria Williams|
| dr.kim@myaidoctor.io               | PROVIDER   | Dr. James Kim     |
| nurse.johnson@myaidoctor.io        | NURSE      | Emily Johnson     |
| admin@myaidoctor.io                | ADMIN      | System Admin      |
| frontdesk@myaidoctor.io            | FRONT_DESK | Lisa Martinez     |

---

## Project Structure

```
myaidoctor/
├── .env                          # Environment variables
├── .gitignore                    # Git ignore rules
├── package.json                  # Dependencies and scripts
├── next.config.js                # Next.js configuration
├── tailwind.config.js            # Tailwind CSS theme (brand colors, fonts)
├── postcss.config.js             # PostCSS config
├── tsconfig.json                 # TypeScript configuration
├── prisma/
│   └── schema.prisma             # Database schema (8 models)
├── scripts/
│   └── seed.js                   # Database seed data
└── src/
    ├── app/
    │   ├── globals.css           # Global styles + Tailwind
    │   ├── layout.tsx            # Root layout
    │   ├── page.tsx              # Root redirect → /dashboard
    │   ├── api/
    │   │   ├── dashboard/route.ts
    │   │   ├── patients/route.ts
    │   │   ├── appointments/route.ts
    │   │   ├── pre-visit/route.ts
    │   │   └── voice-calls/route.ts
    │   ├── dashboard/
    │   │   ├── layout.tsx        # App shell with sidebar
    │   │   └── page.tsx          # Dashboard with stats + schedule
    │   ├── patients/
    │   │   ├── layout.tsx
    │   │   └── page.tsx          # Patient registry
    │   ├── appointments/
    │   │   ├── layout.tsx
    │   │   └── page.tsx          # Appointment scheduler
    │   ├── pre-visit/
    │   │   ├── layout.tsx
    │   │   └── page.tsx          # Pre-visit briefs + detail view
    │   ├── voice-calls/
    │   │   ├── layout.tsx
    │   │   └── page.tsx          # Voice call logs + transcripts
    │   └── settings/
    │       ├── layout.tsx
    │       └── page.tsx          # Settings (6 tabs)
    ├── components/
    │   └── Sidebar.tsx           # Navigation sidebar
    └── lib/
        ├── prisma.ts             # Prisma client singleton
        └── utils.ts              # Utility functions
```

---

## Database Schema Overview

| Model             | Purpose                                           |
|-------------------|---------------------------------------------------|
| User              | Staff accounts (providers, nurses, admin, billing) |
| Clinic            | Practice locations with EHR system config          |
| Patient           | Patient records with conditions, meds, allergies   |
| Appointment       | Scheduled visits with type, status, risk scoring   |
| PreVisitBrief     | AI-generated clinical briefs, SOAP notes, insights |
| VoiceCall         | Call logs with transcripts and sentiment analysis  |
| AuditLog          | HIPAA-compliant activity tracking                  |
| ClinicalProtocol  | Schmitt-Thompson protocols library                 |

---

## Useful Commands

```bash
# Development
npm run dev                    # Start dev server (hot reload)
npm run build                  # Production build
npm start                      # Start production server
npm run lint                   # Run ESLint

# Database
npx prisma studio              # Visual database browser
npx prisma db push             # Push schema changes to DB
npx prisma generate            # Regenerate Prisma client
npx prisma migrate reset       # Reset DB and re-seed
node scripts/seed.js           # Run seed script

# PM2 (production)
pm2 status                     # Check app status
pm2 logs myaidoctor            # View logs
pm2 restart myaidoctor         # Restart app
pm2 monit                      # Real-time monitoring
```

---

## Troubleshooting

**Port 3000 already in use:**
```bash
lsof -i :3000
kill -9 <PID>
```

**PostgreSQL connection refused:**
```bash
sudo systemctl status postgresql
sudo systemctl start postgresql
```

**Prisma schema changes not reflected:**
```bash
npx prisma generate
npx prisma db push --force-reset
node scripts/seed.js
```

**Node.js version mismatch:**
```bash
# Use nvm to manage versions
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

---

## Next Steps (Future Enhancements)

These features are shown in the UI but use mock/seed data. For a production deployment, you would integrate:

1. **Authentication** — Add NextAuth.js with credential provider and session management
2. **Voice AI Integration** — Connect Twilio or Vonage for real inbound/outbound voice calls
3. **EHR Integration** — FHIR APIs for Epic, Athenahealth, Cerner, eClinicalWorks
4. **LLM Pipeline** — Anthropic Claude or OpenAI for clinical synthesis, SOAP generation, and differential analysis
5. **Real-time Updates** — WebSocket or Server-Sent Events for live call monitoring
6. **HIPAA Compliance** — Encryption at rest, audit logging enforcement, BAA agreements
7. **SMS/Chat Channels** — Multi-modal patient engagement via Twilio SMS or web chat
8. **Billing Integration** — CPT code suggestions, insurance verification APIs
