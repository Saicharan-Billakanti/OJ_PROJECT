# Online Judge (OJ) Platform

A full-stack Online Judge (MERN) — users register, browse problems, submit code in Python/C++/Java, and get an automated verdict (Accepted / Wrong Answer / Compilation Error / Runtime Error / Time Limit Exceeded) from code run inside sandboxed Docker containers.

Built as an onboarding task, referencing `All_steps_for_building_scalable_OJ.pdf`, `Online_Judge-HLD_Doc.pdf`, and `architecture.webp` in this repo.

## Architecture

```
frontend (React + Vite)  →  backend (Express + Mongoose)  →  MongoDB
                                      │
                                      ▼
                        executor service (services/executor.js)
                                      │
                          docker run --network none --memory --cpus
                                      │
                    ┌─────────────────┼─────────────────┐
              python:3.11-slim    gcc:latest    eclipse-temurin:17-jdk
```

Each submission: source is written to a temp dir → (compiled languages) compiled inside an ephemeral, resource-capped container, capturing compiler errors → for each test case, a fresh sandboxed container runs the solution with the test's input piped to stdin, output compared to expected → verdict computed and stops at the first failing test → temp dir cleaned up.

Sandboxing per container: `--network none`, `--memory=256m`, `--cpus=0.5`, `--pids-limit=64`, and a 5s (15s for compile) wall-clock timeout enforced via `docker kill` on a named container — chosen because killing the Node-side `docker run` client process does not stop the container itself.

## Stack

- **Backend:** Node.js, Express, Mongoose/MongoDB, JWT auth (bcrypt-hashed passwords), role-based access (user/admin)
- **Frontend:** React (Vite), React Router, Axios
- **Execution:** Docker (official `docker` CLI, invoked via `child_process`, no extra SDK dependency)

## Scope decisions

Built as a real, working MVP rather than a checkbox exercise — the following were deliberately included/excluded:

**In:** auth + RBAC, problem CRUD (admin), 3 languages, Docker-sandboxed execution with resource/time limits, submission history, a public "recent submissions" leaderboard, admin UI for creating problems with test cases (sample vs. hidden).

**Deliberately cut** (called out in the HLD doc as scale/hardening concerns, not needed for this scope): async message queue for submission bursts, plagiarism detection, response caching, persistent warm container pools (each run currently spins up a fresh container per test case — simpler and safer, at some latency cost).

## Running locally

Prerequisites: Node 18+, Docker Desktop running, MongoDB reachable (this project defaults to `mongodb://localhost:27017/oj`).

```bash
# Backend
cd backend
npm install
cp .env.example .env   # adjust if needed
npm run seed            # creates admin user + 3 sample problems
npm start                # http://localhost:5000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev              # http://localhost:5173
```

Pre-pull the language images once so the first submission isn't slow:
```bash
docker pull python:3.11-slim
docker pull gcc:latest
docker pull eclipse-temurin:17-jdk
```

**Demo admin login:** `admin@oj.local` / `Admin@123`

## API overview

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | — | Register |
| POST | `/api/auth/login` | — | Login |
| GET | `/api/auth/me` | user | Current user |
| GET | `/api/problems` | — | List problems |
| GET | `/api/problems/:slug` | — | Problem + sample test cases |
| POST | `/api/problems` | admin | Create problem (+ optional test cases) |
| PUT/DELETE | `/api/problems/:slug` | admin | Update/delete problem |
| POST/GET | `/api/problems/:slug/testcases` | admin | Manage test cases |
| POST | `/api/problems/:slug/submit` | user | Submit code, run against test cases, get verdict |
| GET | `/api/submissions/mine` | user | My submission history |
| GET | `/api/submissions/recent` | — | Recent submissions (leaderboard-style) |

## Known limitations / next steps

- Submission requests are synchronous (client waits on the HTTP response while containers run) — fine at this scale, but a queue (BullMQ/Redis) would be the next step under load, per the HLD doc's "thundering herd" discussion.
- Compiled-language containers currently recompile per submission rather than reusing a warm container pool.
- No plagiarism detection or answer caching yet — intentionally deferred.
