"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Guard from "@/components/Guard";
import { supabase } from "@/lib/supabase";
import {
  DOSE_DAYS,
  addDays,
  fmtDate,
  fmtTime,
  minutesBetween,
  patientName,
  slotISO,
  todayManila,
  type Appointment,
  type Dose,
} from "@/lib/helpers";

function Dashboard() {
  const [date, setDate] = useState(todayManila());
  const [rows, setRows] = useState<Appointment[]>([]);
  const [courseIds, setCourseIds] = useState<Set<string>>(new Set());
  const [dueDoses, setDueDoses] = useState<Dose[]>([]);
  const [walkIn, setWalkIn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const refresh = () => setVersion((v) => v + 1);

  useEffect(() => {
    const id = setInterval(() => setVersion((v) => v + 1), 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, profiles(full_name)")
        .gte("slot_time", slotISO(date, "00:00"))
        .lt("slot_time", slotISO(addDays(date, 1), "00:00"))
        .order("slot_time");
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const list = (data ?? []) as unknown as Appointment[];
      setRows(list);

      const patientIds = list
        .map((a) => a.patient_id)
        .filter((id): id is string => Boolean(id));
      if (patientIds.length > 0) {
        const { data: have } = await supabase
          .from("vaccine_doses")
          .select("patient_id")
          .in("patient_id", patientIds);
        if (active) {
          setCourseIds(new Set((have ?? []).map((d) => d.patient_id as string)));
        }
      } else {
        setCourseIds(new Set());
      }

      const { data: due } = await supabase
        .from("vaccine_doses")
        .select("*, profiles(full_name)")
        .is("given_at", null)
        .lte("scheduled_date", date)
        .order("scheduled_date");
      if (active) setDueDoses((due ?? []) as unknown as Dose[]);
    }
    load();
    return () => {
      active = false;
    };
  }, [date, version]);

  const nextQueueNumber =
    Math.max(0, ...rows.map((r) => r.queue_number ?? 0)) + 1;

  async function run(action: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await action;
    setError(error ? error.message : null);
    refresh();
  }

  const checkIn = (a: Appointment) =>
    run(
      supabase
        .from("appointments")
        .update({
          status: "arrived",
          arrived_at: new Date().toISOString(),
          queue_number: nextQueueNumber,
        })
        .eq("id", a.id)
    );

  const call = (a: Appointment) =>
    run(
      supabase
        .from("appointments")
        .update({ status: "called", called_at: new Date().toISOString() })
        .eq("id", a.id)
    );

  const finish = (a: Appointment) =>
    run(
      supabase
        .from("appointments")
        .update({ status: "done", finished_at: new Date().toISOString() })
        .eq("id", a.id)
    );

  const cancel = (a: Appointment) =>
    run(supabase.from("appointments").update({ status: "cancelled" }).eq("id", a.id));

  const waiting = rows
    .filter((r) => r.status === "arrived")
    .sort((a, b) => (a.queue_number ?? 0) - (b.queue_number ?? 0));

  const callNext = () => {
    if (waiting[0]) call(waiting[0]);
  };

  async function addWalkIn(e: FormEvent) {
    e.preventDefault();
    const name = walkIn.trim();
    if (!name) return;
    const now = new Date().toISOString();
    await run(
      supabase.from("appointments").insert({
        walk_in_name: name,
        slot_time: now,
        status: "arrived",
        arrived_at: now,
        queue_number: nextQueueNumber,
      })
    );
    setWalkIn("");
  }

  async function startCourse(a: Appointment) {
    if (!a.patient_id) return;
    const today = todayManila();
    const now = new Date().toISOString();
    const doses = DOSE_DAYS.map((day, i) => ({
      patient_id: a.patient_id,
      dose_number: i + 1,
      scheduled_date: addDays(today, day),
      given_at: i === 0 ? now : null,
    }));
    await run(supabase.from("vaccine_doses").insert(doses));
  }

  const markGiven = (d: Dose) =>
    run(
      supabase
        .from("vaccine_doses")
        .update({ given_at: new Date().toISOString() })
        .eq("id", d.id)
    );

  return (
    <>
      {error && <div className="notice notice-error">{error}</div>}

      <section className="card stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Queue for {fmtDate(date)}</h2>
          <div className="row">
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Day to show"
            />
            <button
              className="btn btn-primary"
              onClick={callNext}
              disabled={waiting.length === 0}
            >
              Call next patient
            </button>
          </div>
        </div>

        <form onSubmit={addWalkIn} className="row">
          <label className="field" style={{ flex: 1, minWidth: "12rem" }}>
            <span className="muted">Walk-in patient name</span>
            <input
              className="input"
              value={walkIn}
              onChange={(e) => setWalkIn(e.target.value)}
              placeholder="Full name"
            />
          </label>
          <button className="btn" disabled={!walkIn.trim()}>
            Add walk-in to queue
          </button>
        </form>

        {rows.length === 0 ? (
          <p className="muted">No bookings or walk-ins for this day yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Patient</th>
                  <th>No.</th>
                  <th>Status</th>
                  <th>Wait</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td>{fmtTime(a.slot_time)}</td>
                    <td>
                      {patientName(a)}
                      {!a.patient_id && <span className="muted"> (walk-in)</span>}
                    </td>
                    <td>{a.queue_number ?? "-"}</td>
                    <td>
                      <span className={`badge badge-${a.status}`}>{a.status}</span>
                    </td>
                    <td>
                      {a.arrived_at && a.finished_at
                        ? `${minutesBetween(a.arrived_at, a.finished_at)} min`
                        : "-"}
                    </td>
                    <td>
                      <div className="row" style={{ gap: "0.4rem" }}>
                        {a.status === "booked" && (
                          <>
                            <button className="btn btn-small btn-primary" onClick={() => checkIn(a)}>
                              Check in
                            </button>
                            <button className="btn btn-small btn-danger" onClick={() => cancel(a)}>
                              Cancel
                            </button>
                          </>
                        )}
                        {a.status === "arrived" && (
                          <button className="btn btn-small btn-primary" onClick={() => call(a)}>
                            Call
                          </button>
                        )}
                        {a.status === "called" && (
                          <button className="btn btn-small btn-primary" onClick={() => finish(a)}>
                            Finish visit
                          </button>
                        )}
                        {a.patient_id &&
                          (a.status === "called" || a.status === "done") &&
                          !courseIds.has(a.patient_id) && (
                            <button className="btn btn-small" onClick={() => startCourse(a)}>
                              Start vaccine course
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card stack">
        <h2>Doses due or overdue</h2>
        {dueDoses.length === 0 ? (
          <p className="muted">No doses are waiting to be given.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Dose</th>
                  <th>Scheduled</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {dueDoses.map((d) => (
                  <tr key={d.id}>
                    <td>{d.profiles?.full_name ?? "Unnamed patient"}</td>
                    <td>
                      Dose {d.dose_number} (Day {DOSE_DAYS[d.dose_number - 1]})
                    </td>
                    <td>
                      {fmtDate(d.scheduled_date)}
                      {d.scheduled_date < date && (
                        <span className="badge badge-missed" style={{ marginLeft: "0.5rem" }}>
                          Overdue
                        </span>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-small btn-primary" onClick={() => markGiven(d)}>
                        Mark dose given
                      </button>
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

export default function StaffPage() {
  return (
    <>
      <div className="stack">
        <h1>Staff dashboard</h1>
        <p className="lead">
          Check patients in, call the next number and record every dose.
        </p>
      </div>
      <Guard need="staff">{() => <Dashboard />}</Guard>
    </>
  );
}
