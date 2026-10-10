"use client";

/**
 * Top-left wordmark (owner request, Oct 10): one way back to the home screen
 * from anywhere — the lesson used to have no route home short of editing the
 * URL.
 *
 * The lesson UI is a PHASE of the home route (`/`), not a route of its own, so
 * a client-side navigation to "/" while a lesson is on screen is a no-op: Next
 * sees the same route and the learner stays in the lesson. On the home route
 * the click therefore dispatches `HOME_EVENT` instead, which the app shell
 * listens for and answers by returning to the question screen. Off the home
 * route the link navigates normally, so the button keeps working if the app
 * grows another page.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Listened for by components/learning-app.tsx. */
export const HOME_EVENT = "eduvoid:go-home";

const CLASS =
  "inline-flex h-10 items-center px-4 text-[13px] font-semibold tracking-tight text-zinc-700 transition-colors hover:text-violet-700";

export function HomeButton() {
  const onHomeRoute = usePathname() === "/";
  return (
    <Link
      href="/"
      data-testid="home-link"
      aria-label="EduVoid — back to the start"
      className={CLASS}
      onClick={(e) => {
        if (!onHomeRoute) return;
        e.preventDefault();
        window.dispatchEvent(new Event(HOME_EVENT));
      }}
    >
      EduVoid
    </Link>
  );
}
