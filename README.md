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

## UI Libraries: Charts, Icons and Animations
Organized by SWEBOK v4 knowledge areas, so each choice traces from requirement to design, construction, test and upkeep.

### Software Requirements
| Requirement (sprint feature list) | Met by |
|---|---|
| Sprint 5: ratio dashboard on every landing page, colored green (good), yellow (borderline), red (needs a closer look) | An Apache ECharts chart on each ratio card (gauge, bar or ring), plus the card's color and written status |
| Sprint 5: users can add or remove ratios and charts, and choose the chart type | Dashboard's **Customize** tab: a Chart type menu and one dropdown of checkboxes per ratio category |
| Sprint 5: landing page looks like every other page | Same panels, colors, icons and animations as the rest of the app |
| Sprint 2: icons and tooltips on buttons and menus | Lucide icons; every icon button also has a `title` tooltip |

### Software Design
- **Charts (Apache ECharts):** each user picks a chart type in **Customize**:
  - **Gauge** (default): a half dial with red, yellow and green bands set by the ratio's own thresholds; the needle sweeps from 0 to the value.
  - **Bar:** a bar that grows to the value over the same bands.
  - **Ring:** a ring that fills in the ratio's status color.
  - **No chart:** cards show the number and status only.

  All three charts animate when the page loads, and all share one scale (`gauge()` in `ratios.js`). The thresholds come from `GET /api/statements/ratios` (`StatementService.ratios()`), so the backend is the single source of truth for what counts as good.
- **Page animations:** these are plain CSS only, with no animation library. Four shared keyframes in `frontend/src/index.css` use the motion tokens `--fast` (140 ms), `--med` (240 ms) and `--ease`:

  | Animation | Used on |
  |---|---|
  | `fade-up` | page panels, task cards (staggered), the page content area, auth forms, journal lines |
  | `fade-in` | field errors, the help dialog backdrop, event-log before/after tables |
  | `pop-in` | alerts, the calendar, user menu, help dialog, attachment list items, the auth checkmark |
  | `pulse` | the "Loading…" text |

  The splash screen has its own `splash-fade-in` and `splash-fade-out` (`pages/auth/Splash.css`). Transitions also drive these motions:
  - the sidebar highlight sliding to the active menu item (`.app__nav-indicator`);
  - cards lifting on hover;
  - link arrows nudging right on hover;
  - button color changes.
- **Accessibility:** the global `prefers-reduced-motion` rule in `index.css` turns off CSS animation, and `RatioChart.jsx` turns off ECharts animation when that setting is on. Every chart also shows its value and status as text, so color is never the only signal. Print styles switch animation off.
- **Icons (Lucide):** this is the only icon pack, imported per icon (for example `import { BookOpen } from 'lucide-react'`), so only the icons used are bundled. Brand images (emblem, wordmark) are in `frontend/src/assets/brand/`.

### Software Construction (reuse of third-party components)
| Package | Version | License | Used in | Purpose |
|---|---|---|---|---|
| [`echarts`](https://echarts.apache.org/) (Apache ECharts) | 6.1.0 | Apache-2.0 | `components/RatioChart.jsx` | Animated ratio charts (gauge, bar, ring) |
| [`lucide-react`](https://lucide.dev/) | 1.74.0 | ISC | sidebar, top toolbar, task cards, buttons | Icon pack |
| `@pluperfect/react-accountant-calculator` | 1.0.0 (vendored in `frontend/vendor/`) | MIT | `components/CalculatorButton.jsx` | Toolbar calculator |

- ECharts is imported from `echarts/core` with only the parts used registered (`GaugeChart`, `BarChart`, `GridComponent`, `MarkAreaComponent`, `CanvasRenderer`), and `RatioChart` is loaded with `React.lazy`. That keeps it out of the main bundle; it arrives as a separate chunk (about 164 kB gzipped) only when the dashboard shows a chart.
- **To add a chart type:** add it to `CHART_TYPES` in `ratios.js` and to `chartOption()` in `RatioChart.jsx` (registering any new ECharts parts with `echarts.use([...])`); don't import the full `echarts` package.
- **To add an animation:** reuse the shared keyframes and motion tokens before writing a new one.

### Software Testing
- `frontend/src/ratios.test.js` (`npm test`) covers number formatting, the chart scale and color bands, which ratios show by default, and how saved choices are read (including the chart type).
- `StatementRatioTest` (backend) covers the green/yellow/red thresholds.
- To check visually, sign in, open the landing page, and confirm the charts animate, and that the **Customize** choices (ratios and chart type) persist after a reload.

### Software Maintenance and Configuration Management
- Versions are pinned in `frontend/package-lock.json`, so commit it with any dependency change.
- To upgrade, run `npm install echarts@latest lucide-react@latest`, then `npm run lint`, `npm test`, `npm run build`, and check the dashboard and sidebar icons.
- **Customize choices are stored per user in browser `localStorage`** (`limitless.ratio-dashboard.<user id>`), so they don't follow a user to another computer.
- Ratio thresholds are maintained in one place, `StatementService.ratios()`.

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
- **Frontend unit tests** (Node's built-in test runner): `cd frontend && npm test`
- **End-to-end browser tests** (Playwright; uses your installed Chrome). Start MySQL, the backend and
  `npm run dev` first, then: `cd frontend && npm run test:e2e`.
  Results report: `npx playwright show-report`. Each test name starts with its test case ID.
  Every spec runs on desktop Chrome; `sprint5.spec.js` also runs on a tablet (iPad Pro 11) and two phones
  (iPhone 14, Pixel 7), emulated in Chrome. One device only: `npx playwright test --project=phone-ios`.
  Evidence screenshots: `E2E_SCREENSHOTS=1 npm run test:e2e` saves each test's final screen to
  `frontend/test-results/<test>/test-finished-1.png` (also shown in the report).
- Lombok does not support JDK 27 yet; build the backend with JDK 25 or 26
  (e.g. `JAVA_HOME=$(/usr/libexec/java_home -v 26) ./mvnw test`).
  Against the deployed site: `E2E_BASE_URL=https://<domain> E2E_ADMIN_USER=admin E2E_ADMIN_PASSWORD=<password> npm run test:e2e`
  (this creates test users there).
