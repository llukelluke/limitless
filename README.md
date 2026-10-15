# limitless
Class project 

# Local Setup

## Database
### Docker Setup

Download: https://www.docker.com/products/docker-desktop/
1. Install Docker Desktop
2. Run `docker-compose up -d` in project root (where docker-compose.yml is (already included in repo))
3.  Database runs at `localhost:3306`
     - **user**: limitless_user
     - **password**: limitless_pass
     - **db**: limitless_db
4. Confirm connection with: `docker ps` in command prompt which should list the Docker container running on your system.
     - Look for a column called `status` and it should says something like `up x minutes (healthy)` to confirm its running.
5. Note: Run `docker-compose down` to stop the container when you're done working. This leaves the volume intact, so any MySQL data you've entered for testing is still there next time.
6. Note: Run `docker-compose down -v` at any point (e.g., bad database state) to completely wipe the database and start from the plain migration schema again.
7. Note: Since both commands above stop the container, run `docker-compose up -d` afterward to start it again.
 
### MySQL Workbench Setup

Download: https://dev.mysql.com/downloads/workbench/
1. Install MySQL Workbench
     - When installing, MySQL will ask to create an account. This isn't necessary for our project and can be skipped.
3.  Launch MySQL Workbench
     - Click the "+" icon next to MySQL Connections to create a new connection.
4. Connect to Dockerized MySQL (Use the connection details from the Docker setup above (host, port, user, password).
     - If connection fails, wait 10-15s for MySQL to finish initializing and re-try.

## Backend
### Java Setup

Download: https://www.oracle.com/java/technologies/downloads/ (Latest version)
1. Spring Boot needs Java Development Kit to run.
2. After installation, verify with `java -version` in command prompt.

### IDE Setup
(We get the free full version of IntelliJ with our student emails!)
Download: https://www.jetbrains.com/academy/student-pack/

## Running Backend
1. Ensure Docker MySQL is spun up first: `docker-compose up -d`
2. Run the backend at `backend/src/main/java/com/example/limitless/LimitlessApplication.java` (click the green Run button)
3. The backend should start on http://localhost:8080/

## Frontend
### Node.js and npm Setup
Download (Includes npm): https://nodejs.org/en
1. After installation, verify with `node -v` and `npm -v` in command prompt.

### Fygma Reference
https://www.figma.com/design/WGmSKcOk5k5QoOOSW8GCkC/Limitless-Prototype?node-id=2-3&t=6fb2WGCzFgTU3TFF-1

## Running Frontend
1. Start MySQL and the backend first (see above).
2. In `frontend/`, run `npm install` once, then `npm run dev`.
3. Open http://localhost:3000. API calls to `/api` are forwarded to the backend on port 8080.

### First administrator (local)
A fresh database has no users, and only an administrator can create users or approve access requests.
Set `ADMIN_PASSWORD` (and optionally `ADMIN_USERNAME`, default `admin`, and `ADMIN_EMAIL`) as environment
variables in your backend Run Configuration; the backend creates that administrator on startup if none exists.
The password must follow the password rules (8+ characters, starts with a letter, includes a number and a special character).

## Deployment (Railway)
The root `Dockerfile` builds the React app into the Spring Boot jar, so one service serves both the site and the API.

1. On https://railway.app: **New Project → Deploy from GitHub repo → Camlava/limitless**.
2. **+ Create → Database → Add MySQL**.
3. On the app service, **Variables → Raw Editor**:
   ```
   DB_URL=jdbc:mysql://${{MySQL.MYSQLHOST}}:${{MySQL.MYSQLPORT}}/${{MySQL.MYSQLDATABASE}}
   DB_USERNAME=${{MySQL.MYSQLUSER}}
   DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
   JWT_SECRET=<random string, 32+ characters — e.g. output of: openssl rand -base64 48>
   ADMIN_EMAIL=<email for the first administrator>
   ADMIN_PASSWORD=<password for the first administrator>
   ```
4. **Settings → Networking → Generate Domain**, then add `APP_URL=https://<that domain>` (used for links in emails).
5. Log in as `admin` with `ADMIN_PASSWORD`. Emails are written to the service logs until a mail provider is added.

| Variable | Required in production | Default (local) |
|---|---|---|
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | yes | local Docker MySQL |
| `JWT_SECRET` | yes (app won't start without it) | dev-only value |
| `APP_URL` | yes | `http://localhost:3000` |
| `ADMIN_PASSWORD` | first deploy only | unset (no admin created) |
| `ADMIN_USERNAME`, `ADMIN_EMAIL` | no | `admin`, `admin@limitless.local` |
| `PORT` | set by Railway | `8080` |

## Tests
Test plan and test cases (positive and negative, `TC-<area>-<n>`): see the team's test plan document.

- **Backend unit tests** (JUnit 5 + Mockito, no database needed except `LimitlessApplicationTests`):
  `cd backend && ./mvnw test`
- **End-to-end browser tests** (Playwright; uses your installed Chrome). Start MySQL, the backend and
  `npm run dev` first, then: `cd frontend && npm run test:e2e`.
  Results report: `npx playwright show-report`. Each test name starts with its test case ID.
  Against the deployed site: `E2E_BASE_URL=https://<domain> E2E_ADMIN_USER=admin E2E_ADMIN_PASSWORD=<password> npm run test:e2e`
  (this creates test users there).
