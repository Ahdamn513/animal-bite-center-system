"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { userId, profile } = useProfile();

  const role = profile?.role ?? "patient";
  const links = [
    { href: "/book", label: "Book a slot" },
    { href: "/queue", label: "Queue" },
    { href: "/my-doses", label: "My doses" },
    { href: "/faq", label: "Ask a question" },
    ...(role === "staff" || role === "admin"
      ? [{ href: "/staff", label: "Staff" }]
      : []),
    ...(role === "admin" ? [{ href: "/admin", label: "Reports" }] : []),
  ];

  async function logOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand">
          Bite<span>Queue</span>
        </Link>
        <nav className="nav-links" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="nav-user">
          {userId ? (
            <>
              <span className="muted">{profile?.full_name || "Signed in"}</span>
              <button className="btn btn-small" onClick={logOut}>
                Log out
              </button>
            </>
          ) : (
            <Link className="btn btn-small btn-primary" href="/login">
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
