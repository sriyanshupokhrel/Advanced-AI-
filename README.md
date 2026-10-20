# CV Builder: Job-Tailored Interview Presentation

UTS 43007 Advanced Artificial Intelligence, Assignment 3
Multimodal Enhancement of the CV Builder System, **Option B: Job-Tailored Interview Presentation**

## 1. Project Overview

The CV Builder lets a user create and manage CV profiles, add the job they are
applying for, and attach images (such as project screenshots) as visual
evidence. Before anything is used, the user reviews and confirms the
information.

The planned enhancement turns this confirmed CV, job and image data into an
interview presentation tailored to the job, using multimodal AI. This
repository currently contains the **CV Builder foundation and the integration
interface** that the AI stage will use. See
[Current Development Status](#8-current-development-status).

## 2. Technology Stack

- **Next.js 16** (App Router) with **React 19** and **TypeScript**
- **Tailwind CSS 4** for styling
- **Prisma 6** ORM with a local **SQLite** database
- **Zod** for input validation (shared by the browser and the server)
- Node.js built-in test runner for automated tests

## 3. Requirements

- **Node.js 22.18 or newer.** Node 24 LTS is recommended. Tested with 22.18.0
  and 24.11.0.
- **npm 10 or newer** (included with Node.js).
- An internet connection for the first install and for builds (npm packages,
  the Prisma engine and Google Fonts).
- A `.env` file, created from `.env.example` in the steps below. It contains:

  | Variable | Required | Purpose |
  | --- | --- | --- |
  | `DATABASE_URL` | Yes | SQLite file location. The default `file:./dev.db` creates `prisma/dev.db` |
  | `UPLOAD_DIR` | No | Folder for uploaded images. Default: `storage/uploads` |

## 4. Installation and Running

Run these commands from the `cv-builder` folder.

### Windows (PowerShell)

```powershell
cd cv-builder
npm install                     # installs packages and generates the Prisma client
Copy-Item .env.example .env     # creates your local settings file
npm run db:deploy               # creates prisma/dev.db and applies all migrations
npm run dev                     # starts the development server
```

### macOS (Terminal)

```bash
cd cv-builder
npm install                     # installs packages and generates the Prisma client
cp .env.example .env            # creates your local settings file
npm run db:deploy               # creates prisma/dev.db and applies all migrations
npm run dev                     # starts the development server
```

### Open the application

Go to **http://localhost:3000** in your browser. Press `Ctrl + C` in the
terminal to stop the server.

### Starting again later

```bash
cd cv-builder
npm run dev
```

After pulling new changes from the group repository, run `npm install` and
`npm run db:deploy` again before `npm run dev`.

### Notes

- **Use `npm install`, not `npm ci`.** npm's lockfile handling differs
  slightly between operating systems, and `npm install` works on all of them.
- **Do not copy `node_modules` or `prisma/dev.db` between computers** (for
  example through OneDrive or a zip file). Install on each computer, because
  the packages contain operating-system-specific files.
- **Prisma client:** it is generated automatically by `npm install`. If you
  see a "Prisma Client not generated" error, run `npm run db:generate`.

### Other commands

| Command | Purpose |
| --- | --- |
| `npm run build` then `npm start` | Production build and server |
| `npm run check` | TypeScript check, lint and unit tests |
| `npm run test:e2e` | End-to-end API tests (run `npm run build` first). Uses a temporary database; your data is not touched |
| `npm run db:studio` | Browse the database in a web view |
| `npm run db:migrate` | Create a new migration after changing `prisma/schema.prisma` (developers only) |

## 5. Completed Features

All features below are implemented and covered by automated tests.

- **CV Builder:**
  - create, edit, save, preview, print and delete CV profiles;
  - personal details, summary, education, work experience, skills, projects
    and achievements (add, remove, reorder);
  - clear validation messages for missing or invalid information.
- **Job descriptions:**
  - paste, edit and delete target job adverts;
  - the advert text is stored exactly as pasted.
- **CV and job pairing:** pair a CV with a target job for interview
  preparation.
- **Project images:**
  - upload PNG, JPEG, WebP or GIF images (up to 5 MB, 6 per project) and link
    them to a project;
  - each image needs a user-written description;
  - images can be previewed, replaced and deleted;
  - files are checked by their actual content, not their file name.
- **Review and confirm** (`/prepare/{id}`):
  - the user reviews and confirms each CV section, the job and every image,
    and can correct anything;
  - editing confirmed information automatically marks it as needing review
    again.
- **Integration API:** one structured JSON payload containing the CV, job,
  images and confirmation status, for the next development stage.

## 6. Project Structure

| Path | Purpose |
| --- | --- |
| `src/app/` | Pages (`/`, `/cv`, `/jobs`, `/prepare`) and API routes (`src/app/api/`) |
| `src/components/` | User interface components (CV editor, preview, images, review page) |
| `src/lib/db/` | All database access through Prisma |
| `src/lib/validation/` | Validation rules for CVs, jobs, images and confirmations |
| `src/lib/integration/` | Builds the integration payload and the confirmation rules |
| `src/lib/storage/` | Image file storage and image content checks |
| `src/types/` | Shared TypeScript types, including the integration contract |
| `prisma/` | Database schema (`schema.prisma`) and migrations |
| `storage/uploads/` | Uploaded image files (not committed to git) |
| `tests/` | Unit tests, end-to-end tests and test images |
| `docs/` | Integration guide and a real example payload |

## 7. Integration

The next development stage reads one structured payload per CV–job pairing:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/targets` | List CV–job pairings and their readiness |
| `GET /api/targets/{id}/context?requireReady=true` | **The integration payload:** CV, job, images and confirmation status |
| `GET /api/images/{imageId}` | Image file referenced by the payload (`url` field) |

**Confirmation requirement:**

- Only use a payload when `readiness.isReady` is `true`.
- With `?requireReady=true`, the API returns `409` and a list of what still
  needs the user's review, instead of returning unconfirmed data.
- "Confirmed" means the **user reviewed** the information. It has not been
  independently verified.

Server code inside this project can call `getInterviewPreparationPayload(id)`
from `src/lib/db/target-repository.ts` instead of using HTTP.

Full details (field descriptions, examples, error codes) are in
[`docs/INTEGRATION.md`](docs/INTEGRATION.md), with a real example response in
[`docs/integration-payload.example.json`](docs/integration-payload.example.json).

## 8. Current Development Status

| Area | Status |
| --- | --- |
| CV Builder, job descriptions, project images | ✅ Completed and tested |
| User review, confirmation and correction | ✅ Completed and tested |
| Structured integration API | ✅ Completed and tested |
| Multimodal AI processing of CV, job and images | ⏳ Not yet implemented (separate integration stage) |
| Interview presentation generation | ⏳ Not yet implemented (separate integration stage) |
| Evaluation | ⏳ Not yet implemented (separate integration stage) |

The complete group project is **not finished yet**. The stages marked ⏳
will connect through the integration API described above.

## 9. Known Limitations

- **No login or user accounts.** The app is designed for single-user local
  development, so anyone who can reach the server can see all data.
- **Local SQLite database** (`prisma/dev.db`). Data stays on one computer
  and is not shared between group members.
- **Local image storage** (`storage/uploads/`). Images are not backed up and
  are not suitable for hosted deployment without cloud storage.
- **Images are checked by their file header,** not fully decoded.
- **Not-found status code.** Opening a deleted CV, job or pairing page shows a
  "not found" message, but returns HTTP status 200. The API returns 404
  correctly.
- **npm audit** reports high-severity advisories in the Prisma command-line
  tool and in ESLint's development tooling. Neither runs inside the
  application, and the available fixes require breaking major upgrades.
