import { pool } from "@/db/client"

import {
  BootstrapError,
  createFirstUser,
  parseArgs,
  parseFirstUserInput,
} from "./create-first-user"

const USAGE = `
Creates the first account in an empty database.

  pnpm user:create-first --email you@example.com --first-name Ada --last-name Lovelace --role admin --password 'something-long'

The password must be at least 12 characters. Roles: admin, hr. Defaults to hr.
`.trim()

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.help !== undefined) {
    console.log(USAGE)
    return
  }

  const user = await createFirstUser(parseFirstUserInput(args))
  console.log(`Created ${user.email} as ${user.role}.`)
}

main()
  .catch((error: unknown) => {
    if (error instanceof BootstrapError) {
      console.error(`\n${error.message}\n\n${USAGE}`)
    } else {
      console.error("Failed to create the first user:", error)
    }
    process.exitCode = 1
  })
  .finally(() => pool.end())
