import { sql } from "drizzle-orm"
import { afterAll, expect, it } from "vitest"

import { db, pool } from "@/db/client"

afterAll(async () => {
  await pool.end()
})

it("pins the session time zone to UTC so date casts are host independent", async () => {
  const result = await db.execute<{ tz: string; day: string }>(
    sql`select current_setting('TimeZone') as tz,
               (timestamptz '2026-09-19 23:30:00+00')::date::text as day`
  )

  expect(result.rows[0].tz).toBe("UTC")
  expect(result.rows[0].day).toBe("2026-09-19")
})
