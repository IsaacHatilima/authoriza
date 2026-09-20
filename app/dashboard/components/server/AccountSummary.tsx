import type { SessionUser } from "@/shared/session"

interface AccountSummaryProps {
  user: SessionUser
}

/** The signed-in account, rendered on the server from the session. */
export function AccountSummary({ user }: AccountSummaryProps) {
  const rows: ReadonlyArray<[string, string]> = [
    ["Name", user.name ?? "Not set"],
    ["Email", user.email],
    ["Role", user.role],
    ["Email verified", user.emailVerified ? "yes" : "no"],
  ]

  return (
    <section className="rounded-xl bg-muted/50 p-6">
      <h2 className="mb-4 text-sm font-medium">Your account</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
