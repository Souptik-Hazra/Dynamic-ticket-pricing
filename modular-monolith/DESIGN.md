# Modular Monolith Design & Migration Plan

Goal
----
Refactor the backend into a single deployable modular-monolith (one build, one process, one database) that serves a separate frontend via HTTP APIs. Priorities: simplicity, developer ergonomics, and easy deployment.

High-level constraints
---------------------
- Single backend application (one runtime/process).
- Shared single database for all modules.
- Feature-based modules with clear internal layering: controller → service → repository → model.
- Controllers expose only the public HTTP API surface for the frontend.
- Modules communicate via in-process service calls only (no network between modules).
- Shared utilities only for cross-cutting concerns (logging, config, helpers). No business logic in shared utilities.

Folder structure (recommended)
-----------------------------
modular-monolith/
  src/
    modules/
      users/
        controller/
          users.controller.js
        service/
          users.service.js
        repository/
          users.repo.js
        model/
          user.model.js
        routes.js
      tickets/
        controller/
        service/
        repository/
        model/
        routes.js
      ai/
        controller/
        service/
        repository/
        model/
        routes.js
    shared/
      config/
        db.js
        env.js
      utils/
        logger.js
        validators.js
      db/
        index.js      # single DB connection / ORM initialization
    app.js           # single entry, mounts module routes
    server.js        # starts the process
  package.json

Module responsibilities
-----------------------
- controller/: HTTP layer (request validation, response formatting, auth guards). Only controllers are reachable by frontend.
- service/: Business logic. Exposes functions used by controllers and other modules (in-process calls).
- repository/: Data access, queries, transactions. Only services call repositories.
- model/: Domain model definitions and module-specific DTOs. Shared generic DTOs live in `shared/`.
- routes.js: wires controller handlers to Express (or equivalent) router.

Shared components
-----------------
- `shared/config/db.js`: initializes a single DB connection or ORM instance used across modules.
- `shared/utils/logger.js`: structured logging.
- `shared/utils/validators.js`: general validators (not business rules).
- `shared/db/index.js`: export a single DB instance/transaction helper.

Dependency flow and rules
-------------------------
- controller → service → repository
- Services may call other services in-process but prefer well-defined service interfaces to reduce coupling.
- No circular dependencies between modules. Keep shared code minimal.

Database
--------
- Single logical database instance.
- Tables can be grouped by module (naming prefix or schema), but still share the same DB.
- Cross-module joins are permitted but should be reviewed for performance.
- Migrations: use a single migration tool and central migration directory (e.g., `migrations/`).

API exposure
------------
- Only controllers expose API endpoints.
- Keep controllers thin: validate input, call service, return result.
- Example endpoints:
  - `POST /api/auth/login` → `auth` module controller
  - `GET /api/events` → `tickets` module controller
  - `POST /api/tickets/purchase` → `tickets` controller
  - `POST /api/ai/score` → `ai` controller

Internal communication
----------------------
- Use simple in-process calls: import the target module's service and call the exported function.
- Prefer interface-style exports from services (e.g., `module.exports = { createUser, findByEmail }`).
- Keep synchronous-looking code (async/await) — no HTTP calls between modules.

Migration plan (step-by-step)
----------------------------
1. Inventory current codebase and routes. (Map route → current handler file.)
2. Create `src/modules` and `src/shared` folders with templates for controller/service/repo/model.
3. Move existing route handlers into the appropriate module `controller/` and create `routes.js` that mounts them.
4. Extract data access into module `repository/` files; centralize DB connection into `shared/db/index.js`.
5. Move business logic into `service/` files; replace cross-file imports with service-to-service calls where needed.
6. Update `src/app.js` to import and mount each module's `routes.js` onto `/api/<module>`.
7. Create a single `server.js` to start the app and load shared config (port, database URL, env).
8. Create tests (smoke tests) for each controller endpoint.
9. Run migrations centrally and verify DB schema.
10. Deploy single unit and run integration smoke tests.

Simple module template (example)
--------------------------------
// routes.js
// const express = require('express');
// const router = express.Router();
// const controller = require('./controller/users.controller');
// router.post('/login', controller.login);
// module.exports = router;

// controller/users.controller.js
// async function login(req, res, next) { validate(req); const out = await service.login(...); res.json(out);} 

// service/users.service.js
// async function login(creds) { const user = await repo.findByEmail(); /* business logic */ }

// repository/users.repo.js
// async function findByEmail(email) { return db('users').where({ email }).first(); }

Deployment and run (single unit)
--------------------------------
- Build: standard `npm install` / `npm run build` (if using transpilation).
- Run: single command `node src/server.js` or `node dist/server.js` (if compiled).
- Container: single Dockerfile that installs deps and runs the server. No multiple containers required.

Example `server.js` (concept)
------------------------------
// load env/config
// const app = require('./app');
// const port = process.env.PORT || 3000;
// require('./shared/db').connect();
// app.listen(port, () => logger.info(`Listening ${port}`));

Testing & verification
----------------------
- Unit tests for `service/` and `repository/` layers.
- Integration tests (supertest) for controllers to validate full request/response cycles.
- Smoke script: simple script that calls a few public endpoints after deployment.

Rollback and safety
-------------------
- Keep database migrations idempotent where possible or provide rollback scripts.
- Deploy can be a simple container replacement; revert to previous image on failure.

Maintainability checklist
------------------------
- Keep controllers thin and small.
- Keep services domain-focused; avoid cross-cutting business logic in shared classes.
- Enforce module boundaries via code reviews.
- Prefer small, well-named service methods rather than huge exported objects.

Notes on simplicity
-------------------
- This design avoids service-to-service HTTP calls, distributed transactions, and messaging systems — keeping deployment and debugging straightforward.
- Because everything runs in a single process, local debugging and profiling are simple.

Next actions (suggested)
------------------------
- Run an inventory of current route mappings (list of existing routes).
- Create module scaffolding files and begin moving one module at a time (start with low-risk module).
- Add a single DB connector in `shared/db` and refactor repositories to use it.

Contact
-------
For questions about specific modules or to get me to refactor a particular module next, tell me which module to pick first.
