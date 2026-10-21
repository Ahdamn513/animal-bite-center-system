"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useProfile } from "@/lib/useProfile";
import type { Role } from "@/lib/helpers";

type Props = {
  need?: "patient" | "staff" | "admin";
  children: (ctx: { userId: string; role: Role; name: string }) => ReactNode;
};

export default function Guard({ need = "patient", children }: Props) {
  const { loading, userId, profile } = useProfile();

  if (loading) return <p className="muted">Loading your account</p>;

  if (!userId) {
    return (
      <div className="notice stack">
        <p>Log in to use this page.</p>
        <div>
          <Link className="btn btn-primary" href="/login">
            Log in or sign up
          </Link>
        </div>
      </div>
    );
  }

  const role: Role = profile?.role ?? "patient";
  const allowed =
    need === "patient" ||
    (need === "staff" && (role === "staff" || role === "admin")) ||
    (need === "admin" && role === "admin");

  if (!allowed) {
    return (
      <div className="notice notice-error">
        This page is for {need === "admin" ? "admins" : "staff"} only. You are
        signed in as a {role}.
      </div>
    );
  }

  return <>{children({ userId, role, name: profile?.full_name || "there" })}</>;
}
