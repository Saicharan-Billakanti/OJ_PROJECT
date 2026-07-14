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

## Security: containing hostile submissions

An OJ's execution engine is the whole attack surface — every submission is arbitrary, untrusted code. Defenses, layered so no single one is load-bearing:

| Threat | Defense | Verified |
|---|---|---|
| Fork bomb / process explosion | `--pids-limit=64` | Fork bomb killed in **2.8s**, verdict `Runtime Error`, host unaffected |
| Memory exhaustion | `--memory=256m` **+ `--memory-swap=256m`** (disables swap, closing the bypass a memory cap alone leaves open) | OOM-killed in **1.5s** (exit 137) |
| Disk fill | `--read-only` root fs, `--tmpfs /tmp:size=64m`, **`--ulimit fsize`** (~20MB/file) | `OSError: File too large` in **0.77s**, before even hitting the tmpfs cap |
| Writing outside the sandbox | `--read-only` root filesystem — only `/code` and `/tmp` are writable | Confirmed: `OSError: Read-only file system` on write attempts elsewhere |
| Privilege escalation / capability abuse | `--cap-drop=ALL`, `--security-opt=no-new-privileges` | — |
| CPU hog / runaway loop | Wall-clock timeout (Node-side `docker kill`) **+ kernel `--ulimit cpu=10`** as a second, independent backstop in case the Node-side timer ever fails to fire | — |
| Network abuse (exfil, reverse shell, DoS via egress) | `--network none` | — |
| Zombie/orphaned processes not being reaped on kill | `--init` as container PID 1 | — |
| **One host getting overwhelmed by many *different* users submitting at once** (per-user rate limiting alone doesn't stop this) | Global in-process semaphore (`MAX_CONCURRENT_EXECUTIONS = 4`) with a bounded wait queue that fails fast (`503`) past `MAX_QUEUE_LENGTH = 30` instead of piling up unboundedly | Fired 6 concurrent submissions — container count observed to **never exceed 4** at any point |
| Submission spam from one user | Per-user rate limit, 10/min (`middleware/rateLimit.js`) | 11th rapid request in a minute correctly returns `429` |
| Oversized payload | App-level `MAX_CODE_LENGTH = 65536` chars, checked before touching Docker at all | 100KB payload correctly rejected with `400` |

All of the above were exercised with real adversarial code (not just reasoned about) — see the "Verified" column. Every attack was contained by the sandbox with the host remaining fully responsive throughout, and no orphaned containers left behind afterward (`--rm` + `--init` clean up correctly even after a forced `docker kill`).

**Deliberately not done** (real hardening steps, cut for scope — worth knowing about, not oversights): running containers as a non-root user (Windows bind-mount permission semantics make this fragile without more testing time), seccomp/AppArmor custom profiles beyond Docker's defaults, a dedicated gVisor/Firecracker-style sandbox instead of plain Docker isolation, and moving the in-memory rate limiter / concurrency semaphore to Redis for multi-instance deployments.

## Stack

- **Backend:** Node.js, Express, Mongoose/MongoDB, JWT auth (bcrypt-hashed passwords), role-based access (user/admin)
- **Frontend:** React (Vite), React Router, Axios
- **Execution:** Docker (official `docker` CLI, invoked via `child_process`, no extra SDK dependency)

## Scope decisions

Built as a real, working MVP rather than a checkbox exercise — the following were deliberately included/excluded:

**In:** auth + RBAC, full problem CRUD (admin) including a Manage Problems dashboard (edit/delete problems, add/delete individual test cases post-creation), 3 languages, Docker-sandboxed execution with resource/time limits, submission history, a public "recent submissions" leaderboard, per-user rate limiting on submissions (10/min), a 404 page, and a UI/UX design pass (light/dark-aware design system, consistent card layouts, button hierarchy).

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
| POST/GET | `/api/problems/:slug/testcases` | admin | Add / list test cases |
| DELETE | `/api/problems/:slug/testcases/:testCaseId` | admin | Delete a single test case |
| POST | `/api/problems/:slug/submit` | user | Submit code, run against test cases, get verdict (rate-limited: 10/min/user) |
| GET | `/api/submissions/mine` | user | My submission history |
| GET | `/api/submissions/recent` | — | Recent submissions (leaderboard-style) |

## Known limitations / next steps

- **Not deployed yet** — runs locally only for now (by design, at this stage).
- Submission requests are synchronous (client waits on the HTTP response while containers run) — fine at this scale, but a queue (BullMQ/Redis) would be the next step under load, per the HLD doc's "thundering herd" discussion.
- Compiled-language containers currently recompile per submission rather than reusing a warm container pool.
- No plagiarism detection or answer caching yet — intentionally deferred.
- Rate limiting and the concurrency semaphore are both in-memory (per-process) — fine for a single instance; would need a shared store (Redis) behind a load balancer or multiple instances.
