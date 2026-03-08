# Contributing

1. Install dependencies

   ```bash
   npm install
   ```

2. Build plugin in development mode and run in watch mode

   ```bash
   npm run dev
   ```

3. Build plugin in production mode

   ```bash
   npm run build
   ```

4. Run the tests (using Jest)

   ```bash
   # Runs the tests and watches for changes, requires git init first
   npm run test

   # Exits after running all the tests
   npm run test:ci
   ```

5. Spin up a Grafana instance and run the plugin inside it (using Docker)

   ```bash
   npm run server
   ```

6. Run the E2E tests (using Playwright)

   ```bash
   # Spins up a Grafana instance first that we tests against
   npm run server

   # If you wish to start a certain Grafana version. If not specified will use latest by default
   GRAFANA_VERSION=12.0.10 npm run server

   # Start dev build in watch mode
   npm run dev

   # Starts the tests
   npm run e2e
   ```

   If e2e tests time out, make sure that server and build watcher are running
   in the background or in separate terminals.

7. Run the linter

   ```bash
   npm run lint

   # or

   npm run lint:fix
   ```
