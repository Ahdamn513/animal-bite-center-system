"use client";

import { useEffect, useState } from "react";
import Guard from "@/components/Guard";
import { supabase } from "@/lib/supabase";
import {
  SLOT_CAPACITY,
  SLOT_TIMES,
  addDays,
  fmtDate,
  fmtTime,
  slotISO,
  todayManila,
  type Appointment,
} from "@/lib/helpers";

type Message = { kind: "success" | "error"; text: string };

function BookForm({ userId }: { userId: string }) {
  const today = todayManila();
  const [date, setDate] = useState(today);
  const [time, setTime] = useState<string | null>(null);
  const [taken, setTaken] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<Appointment[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [version, setVersion] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      const [counts, bookings] = await Promise.all([
        supabase.rpc("slot_counts", { for_day: date }),
        supabase
          .from("appointments")
          .select("*")
          .eq("patient_id", userId)
          .in("status", ["booked", "arrived", "called"])
          .order("slot_time"),
      ]);
      if (!active) return;
      setNow(Date.now());
      const map: Record<string, number> = {};
      ((counts.data ?? []) as { slot_time: string; taken: number }[]).forEach(
        (r) => {
          map[String(new Date(r.slot_time).getTime())] = Number(r.taken);
        }
      );
      setTaken(map);
      setMine((bookings.data ?? []) as Appointment[]);
    }
    load();
    return () => {
      active = false;
    };
  }, [date, userId, version]);

  async function book() {
    if (!time) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase
      .from("appointments")
      .insert({ patient_id: userId, slot_time: slotISO(date, time) });
    setBusy(false);
    if (error) {
      setMessage({ kind: "error", text: error.message });
    } else {
      setMessage({
        kind: "success",
        text: `Booked for ${fmtDate(date)} at ${fmtTime(slotISO(date, time))}. Check in at the front desk when you arrive.`,
      });
      setTime(null);
      setVersion((v) => v + 1);
    }
  }

  async function cancel(id: string) {
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) setMessage({ kind: "error", text: error.message });
    else {
      setMessage({ kind: "success", text: "Booking cancelled." });
      setVersion((v) => v + 1);
    }
  }

  return (
    <>
      <section className="card stack">
        <h2>Choose a day and time</h2>
        <label className="field" style={{ maxWidth: "14rem" }}>
          Day
          <input
            className="input"
            type="date"
            min={today}
            max={addDays(today, 14)}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setTime(null);
            }}
          />
        </label>

        <div className="slot-grid" role="group" aria-label="Available time slots">
          {SLOT_TIMES.map((t) => {
            const iso = slotISO(date, t);
            const count = taken[String(new Date(iso).getTime())] ?? 0;
            const full = count >= SLOT_CAPACITY;
            const past = new Date(iso).getTime() < now;
            return (
              <button
                key={t}
                type="button"
                className="slot"
                aria-pressed={time === t}
                disabled={full || past}
                onClick={() => setTime(t)}
              >
                {fmtTime(iso)}
                <small>
                  {past ? "Passed" : full ? "Full" : `${SLOT_CAPACITY - count} left`}
                </small>
              </button>
            );
          })}
        </div>

        {message && (
          <div
            className={`notice ${message.kind === "success" ? "notice-success" : "notice-error"}`}
          >
            {message.text}
          </div>
        )}

        <div>
          <button className="btn btn-primary" disabled={!time || busy} onClick={book}>
            {busy ? "Booking" : "Book this slot"}
          </button>
        </div>
      </section>

      <section className="card stack">
        <h2>My bookings</h2>
        {mine.length === 0 ? (
          <p className="muted">
            You have no upcoming bookings. Pick a slot above to book one.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {mine.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {fmtDate(
                        new Date(a.slot_time).toLocaleDateString("en-CA", {
                          timeZone: "Asia/Manila",
                        })
                      )}
                    </td>
                    <td>{fmtTime(a.slot_time)}</td>
                    <td>
                      <span className={`badge badge-${a.status}`}>{a.status}</span>
                    </td>
                    <td>
                      {a.status === "booked" && (
                        <button
                          className="btn btn-small btn-danger"
                          onClick={() => cancel(a.id)}
                        >
                          Cancel booking
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default function BookPage() {
  return (
    <>
      <div className="stack">
        <h1>Book a slot</h1>
        <p className="lead">
          Pick a time and arrive then. Walk-ins are still welcome at the front
          desk.
        </p>
      </div>
      <Guard>{({ userId }) => <BookForm userId={userId} />}</Guard>
    </>
  );
}
