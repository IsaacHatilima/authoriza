CREATE TYPE "public"."user_role" AS ENUM('admin', 'hr');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'hr' NOT NULL;