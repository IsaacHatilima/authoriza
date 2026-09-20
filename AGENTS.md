<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- domain-driver:start -->
## Scaffolding with domain-driver

This project uses [domain-driver](https://github.com/IsaacHatilima/domain-driver) to scaffold feature folders. Scaffold first, then fill in the generated files. Do not hand-write a layer the tool can generate.

- New feature: `npx domain-driver make:feature <feature>/<Entity> -a`
- One layer in an existing feature: `npx domain-driver make:<layer> <feature>/<Entity>` where layer is types, schema, repository, service, controller, component, container, or hook
- Any operation that is not List, Show, Create, Update, or Delete: `npx domain-driver make:action <feature>/<Entity> <actionName>`. Add `--with-input` when it takes a request body and `--returns one|void` when it does not return a list.

Rules the generated code follows, and that new code must keep:

- One file per action per layer. `findActiveUsers` gets `FindActiveUsers.service.ts`, `FindActiveUsers.repository.ts`, and `FindActiveUsers.controller.ts`. It never goes inside `ShowUser.service.ts` or `ListUser.service.ts`.
- Hooks are one file per action too: `<Action><Entity>.hook.ts` exporting `use<Action><Entity>` (for example `useListUser`, `useCreateUser`). There is no combined `use<Entity>.ts`.
- The flow is page, then hook, then API, then service, then repository. The hook calls the endpoint directly; there is no client-side service or repository. Business logic lives in services, data access in repositories, and controllers validate input and call one service.
- Feature folders are kebab-case (`coffee-type`). Entity, action, and class names are PascalCase (`CoffeeType`, `FindActiveUsers`).
- Generated repositories throw until you wire them to your data source. Generated controllers on Node need a line in `<feature>.routes.ts`, and on Nest need registering in `<feature>.module.ts`; the tool prints the exact line.

Full guidance: `.claude/skills/domain-driver/SKILL.md`. Re-run `npx domain-driver init` after upgrading domain-driver to refresh this section.
<!-- domain-driver:end -->
