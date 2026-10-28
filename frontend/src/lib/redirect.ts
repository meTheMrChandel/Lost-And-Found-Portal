"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const AUTH_PAGES = /^\/(login|register|forgot-password)(\/|\?|$)/;

/**
 * Where to send the user after signing in. Only same-site paths are allowed
 * ("//evil.com" and "/\evil.com" are protocol-relative), and never an auth page,
 * so a login can't land back on the login screen.
 */
export function safeRedirect(target: string | null | undefined, fallback = "/"): string {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) {
    return fallback;
  }
  return AUTH_PAGES.test(target) ? fallback : target;
}

export function loginUrl(returnTo: string): string {
  return `/login?redirect=${encodeURIComponent(returnTo)}`;
}

/**
 * For login/register/reset pages: a signed-in user is sent on to `target`. Uses
 * replace() so the back button skips the auth page. Returns true while the page
 * should hold off on showing its form (auth still loading, or redirecting).
 */
export function useRedirectIfSignedIn(target: string): boolean {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace(target);
  }, [loading, user, router, target]);

  return loading || !!user;
}
