"use client"

import { useRouter } from "next/navigation"
import React, { useState } from "react"
import { cn } from "cn"
import { EyeIcon, EyeOffIcon, GalleryVerticalEndIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"

import { useLogin } from "../../hooks/Login.hook"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"

interface LoginFormProps extends React.ComponentProps<"div"> {
  /**
   * How long "Keep me signed in" lasts, in whole days.
   *
   * Passed in rather than read here: the lifetime is server configuration,
   * and this component renders in the browser. Saying it out loud is the
   * point, because a checkbox with no duration is a promise of nothing.
   */
  rememberDays: number
}

export function LoginForm({
  className,
  rememberDays,
  ...props
}: LoginFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { login, loading, error } = useLogin({
    onSuccess: () => router.push("/dashboard"),
  })

  // preventDefault matters beyond avoiding a reload: a native submit would put
  // the password in the URL query string, and from there into history, the
  // Referer header and every access log.
  const onSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    await login({ email, password, remember })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex size-8 items-center justify-center rounded-md">
              <GalleryVerticalEndIcon className="size-6" />
            </div>
            <h1 className="text-xl font-bold">Welcome back</h1>
            {/*
              The login-05 block ships a "Sign up" link here. There is no
              self-registration in this app: an admin provisions accounts, so
              the link had nowhere to point and contradicted the README.
            */}
            <FieldDescription>Sign in to continue.</FieldDescription>
          </div>

          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="m@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={error ? true : undefined}
            />
          </Field>

          <Field data-invalid={error ? true : undefined}>
            <div className="flex items-center">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <a
                href="#"
                // Field sets text-destructive on its whole subtree when
                // invalid. A recovery link is the way out of the error, not
                // part of it, so it keeps its own colour.
                className="ml-auto inline-block text-sm text-foreground underline-offset-4 hover:underline"
              >
                Forgot your password?
              </a>
            </div>
            <InputGroup>
              <InputGroupInput
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                placeholder="••••••••"
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={error ? true : undefined}
              />
              <InputGroupAddon align="inline-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeIcon /> : <EyeOffIcon />}
                </Button>
              </InputGroupAddon>
            </InputGroup>
          </Field>

          <Field orientation="horizontal">
            {/*
              FieldLabel, not FieldTitle. A title renders a div, so clicking
              the words does nothing and people who aim at the text rather
              than the small square are never actually kept signed in.
            */}
            <Checkbox
              id="remember"
              checked={remember}
              onCheckedChange={(checked) => setRemember(checked)}
              aria-describedby="remember-description"
            />
            <FieldContent>
              <FieldLabel htmlFor="remember" className="font-normal">
                Keep me signed in
              </FieldLabel>
              <FieldDescription id="remember-description">
                Stay signed in on this device for {rememberDays} days.
              </FieldDescription>
            </FieldContent>
          </Field>

          {error ? (
            <FieldDescription role="alert" aria-live="polite">
              {error}
            </FieldDescription>
          ) : null}

          <Field>
            <Button type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Login"}
            </Button>
          </Field>

          <FieldSeparator>Or</FieldSeparator>

          <Field className="grid gap-4 sm:grid-cols-2">
            {/* Disabled until an OAuth provider is wired up. */}
            <Button variant="outline" type="button" disabled>
              Continue with Apple
            </Button>
            <Button variant="outline" type="button" disabled>
              Continue with Google
            </Button>
          </Field>
        </FieldGroup>
      </form>

      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}
