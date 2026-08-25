import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const clerkEnabled = !!clerkPk && clerkPk.startsWith("pk_");

const clerk = clerkEnabled ? clerkMiddleware() : undefined;

// Paths that require auth — fail-closed if Clerk is misconfigured
const PROTECTED_PREFIXES = ["/api/bookmarks", "/api/topics", "/api/compare"];

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (clerk) return clerk(request, event);

  // Fail-closed: block protected API routes when Clerk is not configured
  const path = request.nextUrl.pathname;
  if (PROTECTED_PREFIXES.some((p) => path.startsWith(p))) {
    console.error("Clerk is not configured — blocking protected route:", path);
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  return NextResponse.next();
}

/**
 * Match ONLY the Clerk-dependent surface — not every page.
 *
 * This used to be a negative matcher ("everything that isn't a static asset"),
 * which ran `clerkMiddleware()` on all ~650 sitemap-advertised dossier pages.
 * None of them read a session: `auth()` is called in exactly the five API
 * routes below, in `/news`, and in `components/AuthButtons` — which only
 * `/news` renders. The root layout is Clerk-free; `ClerkProvider` is scoped to
 * the `(auth)` route group.
 *
 * The cost was the whole point of the change. Middleware is billed per
 * invocation and, unlike the page render, an ISR cache HIT does not avoid it:
 * a 24h sample on 2026-08-25 logged 822 middleware invocations against 816
 * function invocations, so it was ~50% of Fluid Active CPU and the half no
 * amount of caching could reach.
 *
 * ⚠️ Adding `auth()`, `currentUser()`, or a server-side Clerk component to a
 * route means adding that route here. Clerk throws if `auth()` runs on a path
 * `clerkMiddleware()` did not cover, so the failure is loud rather than a
 * silent logged-out render.
 *
 * `/api/compare/:path*` deliberately covers `/api/compare/daily` as well.
 * `daily` reads no session, but the fail-closed `PROTECTED_PREFIXES` check
 * above matched it under the old catch-all matcher and narrowing that
 * behaviour is not this change's business.
 */
export const config = {
  matcher: [
    "/news",
    "/sign-in/:path*",
    "/sign-up/:path*",
    "/api/bookmarks/:path*",
    "/api/compare/:path*",
    "/api/topics/:path*",
    "/api/sign-out/:path*",
  ],
};
