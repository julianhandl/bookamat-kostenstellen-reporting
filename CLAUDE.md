## Project setup

This project uses hono as it's backend and a simple static html with javascript to show the data from hono.

Follow the existing file and folderstructure. Avoide barrel files.
Create simple and readable code. Early returns. Strictly typed in and output of each method. Avoid atomic functions and group code logically. No one of function that are not reused anywhere. Prefer longer function (max 100 lines) for readability and easy mental model, but keep the complexity low.

Don't map datastructures. I want to keep working with the dtos from the bookamat api.

## Project Context

This project is a reporting tool that gets data from the api of an accounting software, processes it and generates an html report from it.

### Accounting software

Bookamat is an austrian accounting software. It provides full api access.
https://www.bookamat.com/dokumentation/api/v1/index.html
The software provides full accounting management for austria.
It is very feature rich and can generate the austrian E1a report (Einkommenssteuererklärung).

If you run multiple businesses in austria as one person, you have to provide the Einkommenssteuererklärung (E1a) for every business indivitually. This is not supported in bookamat.

### Feature of this webapp

Providing E1a reports for every cost center (isolated)

- getting all the data from the bookamat api
- processing the report
- showing the report for every cost center

## Package Manager and Runtime: Bun

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.
