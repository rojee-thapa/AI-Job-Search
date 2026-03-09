# AI Job Search Agent

An AI-powered job search automation tool that discovers relevant job postings, scores them against your resume, generates tailored application emails, and helps you prepare for interviews — all in one dashboard.

## Features

- **Resume Analysis** — Upload a PDF or DOCX resume; OpenAI parses it into structured data (skills, experience, education) and suggests improvements
- **AI Job Discovery** — Uses Perplexity's real-time web search to find current job postings matched to your target roles, skills, and location preferences
- **Match Scoring** — Every job is scored against your resume across five dimensions: skills (40%), experience (20%), salary (15%), location (15%), and visa sponsorship (10%)
- **Application Tracking** — Track every application through its full lifecycle (applied → interview scheduled → offer received → rejected)
- **AI Email Generation** — Generate cold outreach, follow-up, and thank-you emails tailored to each job and company
- **Interview Prep** — Generate role-specific interview questions with suggested answers and tips powered by OpenAI
- **Saved Jobs** — Bookmark jobs to revisit later
- **Settings & Preferences** — Configure target roles, locations, salary range, visa status, and work mode preferences

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Radix UI |
| Backend | Node.js, Express |
| Database | PostgreSQL 16 |
| Cache / Queues | Redis |
| AI — Resume & Email | OpenAI GPT-4o |
| AI — Job Discovery | Perplexity Sonar Pro (real-time web search) |
| Web Scraping | Playwright (Chromium) |
| Email Delivery | SendGrid / Gmail OAuth |
| Auth | JWT (bcrypt password hashing) |
| Containerization | Docker + Docker Compose |

## Project Structure

```
ai-job-agent/
├── backend/
│   ├── src/
│   │   ├── controllers/       # Route handlers (auth, jobs, resume, email, interview, ...)
│   │   ├── services/
│   │   │   ├── ai/            # OpenAI integrations (resume analyzer, job matcher, email generator, interview prep)
│   │   │   ├── jobDiscovery/  # Perplexity + Playwright scrapers (LinkedIn, Indeed, Wellfound)
│   │   │   ├── email/         # SendGrid / Gmail sending
│   │   │   └── tracking/      # Google Sheets sync
│   │   ├── routes/            # Express routers
│   │   ├── middleware/        # Auth (JWT), error handler, file upload
│   │   ├── config/            # Database (pg pool) and Redis setup
│   │   ├── jobs/              # Cron jobs (daily discovery, follow-up alerts)
│   │   └── utils/             # Logger, helpers
│   ├── migrations/            # SQL schema files (run in order)
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/               # Next.js App Router pages
│   │   │   ├── (app)/         # Authenticated pages (dashboard, jobs, resume, email, ...)
│   │   │   └── login/         # Auth pages
│   │   ├── components/        # Reusable UI components
│   │   ├── lib/               # API client, auth helpers, utility functions
│   │   └── types/             # TypeScript interfaces
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Prerequisites

- **Node.js** >= 20
- **PostgreSQL** 16
- **Redis** 7
- **API Keys:**
  - [OpenAI](https://platform.openai.com/api-keys) — resume analysis, email generation, interview prep
  - [Perplexity](https://www.perplexity.ai/settings/api) — real-time job discovery
  - [SendGrid](https://app.sendgrid.com/settings/api_keys) *(optional)* — sending emails

## Installation

### Option A: Docker Compose (recommended)

The easiest way to run everything together.

**1. Clone the repo**

```bash
git clone https://github.com/rojee-thapa/AI-Job-Search.git
cd AI-Job-Search
```

**2. Configure environment**

```bash
cp .env.example .env
```

Open `.env` and fill in your API keys:

```env
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...
JWT_SECRET=your-random-secret-string
```

**3. Start all services**

```bash
docker compose up --build
```

The database schema is applied automatically on first start via the migration files in `backend/migrations/`.

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Health check: http://localhost:4000/health

---

### Option B: Local Development

Run the backend and frontend separately without Docker.

**1. Install PostgreSQL and Redis**

On macOS with Homebrew:

```bash
brew install postgresql@16 redis
brew services start postgresql@16
brew services start redis

# Initialize the database (first time only)
initdb -D /opt/homebrew/var/postgresql@16
createdb aijobagent
```

On Ubuntu/Debian:

```bash
sudo apt install postgresql redis-server
sudo systemctl start postgresql redis-server
sudo -u postgres createdb aijobagent
```

**2. Apply the database schema**

```bash
psql -d aijobagent -f backend/migrations/001_initial_schema.sql
psql -d aijobagent -f backend/migrations/002_add_features.sql
```

**3. Configure the backend**

```bash
cp .env.example backend/.env
```

Edit `backend/.env`:

```env
# Required
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...
JWT_SECRET=your-random-secret-string

# Match your local PostgreSQL setup
# macOS Homebrew: uses your OS username, no password
DATABASE_URL=postgresql://YOUR_OS_USERNAME@localhost:5432/aijobagent

# Linux default:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aijobagent
```

**4. Install backend dependencies and start**

```bash
cd backend
npm install
npx playwright install chromium   # needed for LinkedIn/Indeed scrapers
npm run dev
```

Backend runs on http://localhost:4000.

**5. Configure the frontend**

In a new terminal:

```bash
# From the project root
echo "NEXT_PUBLIC_API_URL=http://localhost:4000/api" > frontend/.env.local
```

**6. Install frontend dependencies and start**

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:3000.

## Environment Variables

All variables are documented in `.env.example`. The required ones are:

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o |
| `PERPLEXITY_API_KEY` | Perplexity API key for job discovery |
| `JWT_SECRET` | Random string used to sign auth tokens |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection URL (default: `redis://localhost:6379`) |

Optional (for email sending):

| Variable | Description |
|---|---|
| `SENDGRID_API_KEY` | SendGrid API key |
| `SENDGRID_FROM_EMAIL` | Sender email address |
| `GMAIL_CLIENT_ID` | Gmail OAuth client ID (alternative to SendGrid) |
| `GMAIL_REFRESH_TOKEN` | Gmail OAuth refresh token |

## Usage

1. **Sign up** at http://localhost:3000
2. **Upload your resume** (PDF or DOCX) — the AI will parse and score it
3. **Set your preferences** in Settings — target roles, locations, salary range, work mode
4. **Click "Discover Jobs"** on the Jobs page — Perplexity searches for real current openings and scores them against your resume (runs in the background, takes ~1-2 minutes)
5. **Browse matched jobs** — filtered and ranked by match score
6. **Track applications** — mark jobs as applied and follow their status
7. **Generate emails** — cold outreach or follow-ups written by AI for each job
8. **Prep for interviews** — generate role-specific questions and answers

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/resume/upload` | Upload and parse resume |
| GET | `/api/resume` | Get active resume |
| POST | `/api/jobs/discover` | Trigger background job discovery |
| GET | `/api/jobs` | List matched jobs (paginated, filterable) |
| GET | `/api/jobs/:id` | Get job details |
| POST | `/api/jobs/:id/save` | Save / unsave a job |
| POST | `/api/jobs/:id/hide` | Hide a job |
| GET | `/api/applications` | List applications |
| POST | `/api/applications` | Create application |
| PATCH | `/api/applications/:id` | Update application status |
| POST | `/api/email/generate` | Generate an email for a job |
| GET | `/api/interview` | List interview sessions |
| POST | `/api/interview/generate` | Generate interview questions |
| GET | `/api/preferences` | Get user preferences |
| PUT | `/api/preferences` | Update user preferences |

## Notes

- Job discovery runs asynchronously — after clicking "Discover Jobs", wait ~1-2 minutes then refresh the page
- LinkedIn and Indeed scrapers use Playwright (headless Chromium). Make sure to run `npx playwright install chromium` before starting the backend locally
- API keys are never committed — `.env` files are excluded by `.gitignore`