# Web client

- From the root of the repository: `npm run build -w client/web` checks the types and builds with Vite, `npm test -w client/web` runs the tests on Vitest, `npm run dev -w client/web` starts it. Until the real gateway exists, `npm run fake-gateway -w client/web` serves a fake one for development and the tests; `npm run check:bundle -w client/web` fails if the build would load anything from another domain (BR-01).
- React with Vite, laid out like Notion but only for the user stories.
- The BlockNote editor with the schema of US-07 is in `src/editor/`, the only folder that imports BlockNote.
- The calls to the gateway are typed from the OpenAPI specifications of the services by `npm run gen:api -w client/web`.

## State

Sign-in and registration, the Workspace directory, the workspace with its sidebar, pages, settings and members. What has no client API yet, the page tree, the session, the threads and the notifications, shows empty.
