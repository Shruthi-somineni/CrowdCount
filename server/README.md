# Tutly Auth Server (dev)

This is a tiny Node.js Express server used for local development to issue JWTs.

Now backed by a local SQLite database (server/data.db) for simple persistence.

Quick start

1. Install dependencies:

  npm install

2. (Optional) create a `.env` file in the `server/` folder with a strong JWT secret:

  JWT_SECRET=some_long_random_secret_here

3. Start the server (it will create the DB and seed a default admin if needed):

  npm start

Endpoints

- POST /api/login
  - Body: { username, password }
  - Returns: { token }

- POST /api/register
  - Body: { username, password, name, email }
  - Returns: { token }

- POST /api/verify
  - Body: { token }
  - Returns: { ok: true, payload }

- GET /api/me (protected)
  - Header: Authorization: Bearer <token>
  - Returns: { ok: true, user }

- POST /api/admin-login
  - Body: { username, password }
  - Returns: { token }

- POST /api/verify-admin
  - Body: { token }
  - Returns: { ok: true, payload }

Notes & Next steps

- The server now persists users and admins in `server/data.db` (SQLite). A default admin is seeded: `admin` / `admin123`.
- This is still a development setup. For production, secure secrets, use hashed passwords, and a full RDBMS or managed DB service.
- To reset the DB, delete `server/data.db` and restart the server.

Notes on JWT secret

- The server will read `JWT_SECRET` from environment (or from `.env` when present). If not set, it falls back to a default insecure secret and prints a warning. Set `JWT_SECRET` in `.env` for any non-development use.
