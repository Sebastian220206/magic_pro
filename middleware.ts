import withAuth from "next-auth/middleware";

/**
 * Guard page navigations that require a session.
 *
 * `pages.signIn` must be repeated here: middleware runs in its own context and
 * does not read `authOptions`, so without it users are bounced to NextAuth's
 * built-in sign-in UI instead of the app's own /login page.
 *
 * API routes are deliberately excluded from the matcher — they enforce
 * authorization themselves via `lib/apiAuth` and must answer 401/403 as JSON
 * rather than redirect.
 */
export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/account/:path*",
    "/dashboard/:path*",
    "/project/:path*",
    "/admin/:path*",
  ],
};
