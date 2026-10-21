import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "BiteQueue",
  description:
    "Queue, appointment and vaccine follow-up system for animal bite centers.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        <main className="page">{children}</main>
        <footer className="footer">
          BiteQueue is an IT415 prototype. It gives general information only
          and is not medical advice.
        </footer>
      </body>
    </html>
  );
}
