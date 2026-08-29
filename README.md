# Hamodi Theory

Hamodi Theory is a Hebrew-first driving-theory learning platform built with
Next.js. It provides authenticated course study, question-bank practice,
timed exams, multilingual UI, and production text-to-speech support.

## Features

- Eight course types: motorcycle, private car, truck, heavy truck, bus,
  tractor, jet ski, and boat.
- Credential-based authentication with protected course routes.
- Additional short-lived access grant for the two water courses.
- Paginated question-bank practice and randomized timed exams.
- Hebrew, Arabic, and English UI with cached AI translations.
- Question and answer audio in production.
- Responsive dark/light interface with RTL and LTR support.
- MongoDB-backed users, questions, translations, and audio metadata.

## Technology

- Next.js 14 App Router and React 18
- NextAuth credentials authentication
- MongoDB
- Tailwind CSS
- OpenAI for cached UI translation
- ElevenLabs and Google Translate TTS
- Cloudflare R2-compatible object storage

Core versions currently resolved by `package-lock.json`:

| Package | Version |
| --- | --- |
| Next.js | `14.2.35` |
| React / React DOM | `18.2.0` |
| NextAuth | `4.24.13` |
| MongoDB driver | `7.0.0` |
| OpenAI | `6.15.0` |
| AWS S3 client | `3.1037.0` |
| ElevenLabs | `2.44.0` |
| Tailwind CSS | `4.1.18` |

## Supported courses

| Route type | Course |
| --- | --- |
| `motorcycle` | Motorcycle |
| `car` | Private car |
| `truck` | Truck |
| `cTruck` | Heavy truck |
| `bus` | Bus |
| `tractor` | Tractor |
| `jetski` | Jet ski |
| `boat` | Boat |

All courses require a valid user session. Jet ski and boat also require the
shared water-course password, which creates a signed, user-bound access grant.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` and configure the required services. Never commit this
   file. `NEXTAUTH_URL` must be the valid HTTP(S) origin of this application,
   without credentials, control characters, or backslashes.

3. Start development:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

Real TTS requests are deliberately disabled in development. Production builds
retain the existing TTS request, generation, cache, and playback flow.

## Database prerequisites

The repository does not include database seeds or migrations. A usable
installation requires an already provisioned MongoDB database containing:

- Login user records.
- The shared water-course password record.
- All eight canonical question collections.

Provision these records through the project's trusted administrative process.
Do not commit database exports, password hashes, decrypted passwords, or real
user data.

## Environment variables

The application references these variable names. Values belong only in local
or deployment environment configuration.

| Area | Variables |
| --- | --- |
| MongoDB | `MONGO_URI` |
| Authentication | `NEXTAUTH_URL`, `NEXTAUTH_SECRET` |
| Translation | `OPENAI_API_KEY` |
| TTS | `ELEVENLABS_API_KEY` |
| Object storage | `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_PUBLIC_URL` |
| Administrative password flow | `PASSWORD_SECRET`, `STATIC_PIN` |

`NODE_ENV` is normally supplied by Next.js or the deployment platform.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create an optimized production build |
| `npm run start` | Run the production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run the local-only verification suite when present |

Test files are intentionally not committed to GitHub. A fresh GitHub clone can
therefore run zero tests until the local verification suite is supplied. The
suite is retained only in the maintainer's local development workspace.

## Main routes

- `/` — course dashboard
- `/about` — public information
- `/contactUs` — contact page
- `/login` — authentication
- `/courses/:type` — protected course landing page
- `/courses/:type/questions` — protected question bank
- `/courses/:type/exam` — protected timed exam

## Assets and data

General images live under `public/images`. Course question images live under
`public/question-images/<course>`. Each canonical course uses its matching
MongoDB question collection.

## Deployment

Deploy as a Node-capable Next.js application with MongoDB connectivity and
outbound access to the configured translation, TTS, and object-storage
services. Configure all required environment variables in the deployment
platform, run `npm run build`, and deploy the resulting application.
