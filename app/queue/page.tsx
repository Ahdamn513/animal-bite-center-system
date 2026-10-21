"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { slotISO, addDays, todayManila, type Appointment } from "@/lib/helpers";

type Entry = { queue_number: number; status: string };

export default function QueuePage() {
  const { userId } = useProfile();
  const [board, setBoard] = useState<Entry[]>([]);
  const [mine, setMine] = useState<Appointment | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      const today = todayManila();
      const boardRes = await supabase.rpc("queue_board");
      let myRow: Appointment | null = null;
      if (userId) {
        const { data } = await supabase
          .from("appointments")
          .select("*")
          .eq("patient_id", userId)
          .gte("slot_time", slotISO(today, "00:00"))
          .lt("slot_time", slotISO(addDays(today, 1), "00:00"))
          .neq("status", "cancelled")
          .order("slot_time")
          .limit(1);
        myRow = ((data ?? [])[0] as Appointment | undefined) ?? null;
      }
      if (!active) return;
      setBoard((boardRes.data ?? []) as Entry[]);
      setMine(myRow);
      setLoaded(true);
    }
    load();
    return () => {
      active = false;
    };
  }, [userId, tick]);

  const called = board.filter((e) => e.status === "called");
  const waiting = board.filter((e) => e.status === "arrived");
  const done = board.filter((e) => e.status === "done");
  const serving = called.length ? Math.min(...called.map((e) => e.queue_number)) : null;
  const lastDone = done.length ? Math.max(...done.map((e) => e.queue_number)) : null;

  const myNumber = mine?.queue_number ?? null;
  const ahead =
    myNumber !== null ? waiting.filter((e) => e.queue_number < myNumber).length : null;

  return (
    <>
      <div className="stack">
        <h1>Live queue</h1>
        <p className="lead">Updates every 10 seconds. You do not need to refresh.</p>
      </div>

      <section className="ticket" aria-live="polite">
        <span className="ticket-label">Now serving</span>
        <span className="ticket-number">
          {serving ?? (lastDone !== null ? lastDone : "-")}
        </span>
        <span className="ticket-note">
          {serving !== null
            ? `${waiting.length} waiting after this number`
            : loaded
              ? "No one is being called right now"
              : "Loading the queue"}
        </span>
      </section>

      <section className="card stack">
        <h2>Your place</h2>
        {!userId ? (
          <p className="muted">
            <Link href="/login">Log in</Link> to see your own queue number.
          </p>
        ) : !mine ? (
          <p className="muted">
            You have no booking today. <Link href="/book">Book a slot</Link>.
          </p>
        ) : mine.status === "booked" ? (
          <p>
            You are booked for today. Check in at the front desk when you
            arrive and you will get a queue number.
          </p>
        ) : mine.status === "called" ? (
          <div className="notice notice-success">
            Your number {myNumber} is being called. Please go to the counter.
          </div>
        ) : mine.status === "done" ? (
          <p>
            Your visit is done. See <Link href="/my-doses">My doses</Link> for
            your follow-up dates.
          </p>
        ) : (
          <p>
            Your number is <strong>{myNumber}</strong>.{" "}
            {ahead === 0
              ? "You are next."
              : `${ahead} ${ahead === 1 ? "person is" : "people are"} ahead of you.`}
          </p>
        )}
      </section>
    </>
  );
}
