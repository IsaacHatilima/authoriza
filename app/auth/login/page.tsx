import { rememberTtlMs } from "@/lib/session-lifetime"

import { LoginForm } from "./components/client/LoginForm"

const MS_PER_DAY = 24 * 60 * 60 * 1000

export default function LoginPage() {
  // Read on the server, where the configuration lives, and handed to the
  // form as a plain number so the client bundle carries no env access.
  const rememberDays = Math.floor(rememberTtlMs() / MS_PER_DAY)

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm rememberDays={rememberDays} />
      </div>
    </div>
  )
}
