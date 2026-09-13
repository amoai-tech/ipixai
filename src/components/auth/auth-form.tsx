"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

import { getAuthSubmitErrorMessage } from "./auth-error-message";
import styles from "./auth-form.module.css";

// Google OAuth is shown only when the provider is configured for the target
// environment (Supabase Auth provider + redirect allow-list). Default off.
const GOOGLE_OAUTH_ENABLED =
  process.env.NEXT_PUBLIC_SUPABASE_GOOGLE_OAUTH_ENABLED === "true";

export type AuthFormMode = "signin" | "signup";

/**
 * IPI-1157 · AUTH-UX-001 — shared auth core for /login and /signup.
 *
 * `mode` is a fixed prop, not client state: the URL is authoritative (route
 * intent), not a toggle inside the form. This is the same Supabase client,
 * duplicate-submit guard, error copy, OAuth flow, and confirmation-state
 * behavior as the pre-split combined /login form — nothing about the auth
 * logic itself changed, only which route renders which mode.
 */
export function AuthForm({ mode, next }: { mode: AuthFormMode; next: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  const destination = next ?? "/app";
  // Preserve `next` across the cross-link so switching intent doesn't lose it.
  const otherRouteHref = mode === "signin"
    ? next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"
    : next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  async function submit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setError(null);
    setSubmitting(true);
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) {
          setError("Sign up failed");
          return;
        }
        // Email confirmation is enabled on hosted Supabase: signUp succeeds
        // with a null session. Show a confirmation-required state instead of
        // navigating to an authenticated route.
        if (!data.session) {
          setConfirmed(true);
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          setError("Sign in failed");
          return;
        }
        await supabase.auth.getClaims();
      }
      router.push(destination);
      router.refresh();
    } catch (error) {
      setError(getAuthSubmitErrorMessage(error, mode));
    } finally {
      setSubmitting(false);
      submittedRef.current = false;
    }
  }

  async function onGoogle() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setError(null);
    setSubmitting(true);
    try {
      const supabase = createClient();
      const callback = new URL(`${window.location.origin}/auth/callback`);
      if (next) {
        callback.searchParams.set("next", next);
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callback.toString() },
      });
      if (error) setError("Sign in failed");
    } catch (error) {
      setError(getAuthSubmitErrorMessage(error, mode));
    } finally {
      setSubmitting(false);
      submittedRef.current = false;
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.stack}>
        <p className={styles.brand}>iPix</p>
        <p className={styles.lede}>
          {mode === "signin" ? "Operator sign in" : "Create your account"}
        </p>
        <div className={styles.card}>
          {confirmed ? (
            <>
              <p className={styles.confirm} role="status">
                Check your email to confirm your account. You can sign in once
                your email is confirmed.
              </p>
              <Link href={otherRouteHref} className={styles.link}>
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              <h1 className={styles.title}>
                {mode === "signin" ? "Welcome" : "Sign up"}
              </h1>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!event.currentTarget.reportValidity()) return;
                  void submit();
                }}
                className={styles.form}
              >
                <div className={styles.field}>
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    className={styles.input}
                    type="email"
                    name="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    className={styles.input}
                    type="password"
                    name="password"
                    autoComplete={
                      mode === "signin" ? "current-password" : "new-password"
                    }
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>
                {error ? (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  className={styles.submit}
                  disabled={submitting}
                >
                  {submitting
                    ? "Please wait…"
                    : mode === "signin"
                      ? "Sign in"
                      : "Sign up"}
                </button>
              </form>

              {GOOGLE_OAUTH_ENABLED ? (
                <>
                  <div className={styles.divider}>or</div>
                  <button
                    type="button"
                    className={styles.google}
                    onClick={onGoogle}
                    disabled={submitting}
                  >
                    Continue with Google
                  </button>
                </>
              ) : null}

              <p className={styles.switch}>
                {mode === "signin" ? (
                  <>
                    New to iPix?{" "}
                    <Link href={otherRouteHref} className={styles.link}>
                      Create an account
                    </Link>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <Link href={otherRouteHref} className={styles.link}>
                      Sign in
                    </Link>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
