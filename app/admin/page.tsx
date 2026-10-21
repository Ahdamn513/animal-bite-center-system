"use client";

import { useEffect, useState } from "react";
import Guard from "@/components/Guard";
import { supabase } from "@/lib/supabase";
import {
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

type Period = "today" | "week" | "all";

function avg(values: number[]): number | null {
  return values.length
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : null;
}

function Reports() {
  const [period, setPeriod] = useState<Period>("today");
  const [visits, setVisits] = useState<Appointment[]>([]);
  const [doses, setDoses] = useState<Dose[]>([]);
  const [chatCount, setChatCount] = useState(0);
  const [baseline, setBaseline] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const today = todayManila();
      let q = supabase
        .from("appointments")
        .select("*, profiles(full_name)")
        .order("slot_time", { ascending: false });
      if (period === "today") q = q.gte("slot_time", slotISO(today, "00:00"));
      if (period === "week") q = q.gte("slot_time", slotISO(addDays(today, -6), "00:00"));

      const [a, d, c] = await Promise.all([
        q,
        supabase.from("vaccine_doses").select("*").lte("scheduled_date", today),
        supabase.from("chat_logs").select("id", { count: "exact", head: true }),
      ]);
      if (!active) return;
      setVisits((a.data ?? []) as unknown as Appointment[]);
      setDoses((d.data ?? []) as Dose[]);
      setChatCount(c.count ?? 0);
    }
    load();
    return () => {
      active = false;
    };
  }, [period]);

  const done = visits.filter((v) => v.status === "done");
  const total = done
    .filter((v) => v.arrived_at && v.finished_at)
    .map((v) => minutesBetween(v.arrived_at!, v.finished_at!));
  const toCall = visits
    .filter((v) => v.arrived_at && v.called_at)
    .map((v) => minutesBetween(v.arrived_at!, v.called_at!));

  const avgTotal = avg(total);
  const avgCall = avg(toCall);
  const given = doses.filter((d) => d.given_at).length;
  const completion = doses.length ? Math.round((given / doses.length) * 100) : null;
  const missed = doses.filter((d) => !d.given_at).length;

  const baselineNum = Number(baseline);
  const reduction =
    baselineNum > 0 && avgTotal !== null
      ? Math.round(((baselineNum - avgTotal) / baselineNum) * 100)
      : null;

  return (
    <>
      <div className="row">
        <label className="field">
          Period
          <select
            className="input"
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
          >
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="all">All time</option>
          </select>
        </label>
      </div>

      <div className="stat-grid">
        <div className="card">
          <p className="muted">Visits recorded in BiteQueue</p>
          <p className="stat-value">{visits.length}</p>
        </div>
        <div className="card">
          <p className="muted">Average time, arrival to end of visit</p>
          <p className="stat-value">{avgTotal === null ? "-" : `${avgTotal} min`}</p>
        </div>
        <div className="card">
          <p className="muted">Average time, arrival to being called</p>
          <p className="stat-value">{avgCall === null ? "-" : `${avgCall} min`}</p>
        </div>
        <div className="card">
          <p className="muted">Doses given on schedule so far</p>
          <p className="stat-value">{completion === null ? "-" : `${completion}%`}</p>
          <p className="muted">{given} given, {missed} not yet given</p>
        </div>
        <div className="card">
          <p className="muted">Chatbot questions logged</p>
          <p className="stat-value">{chatCount}</p>
        </div>
      </div>

      <section className="card stack">
        <h2>Compare with the baseline</h2>
        <p className="muted">
          Enter the average time (in minutes) you measured at the center before
          BiteQueue. The objective is at least a 50% reduction.
        </p>
        <label className="field" style={{ maxWidth: "14rem" }}>
          Baseline minutes
          <input
            className="input"
            type="number"
            min="1"
            value={baseline}
            onChange={(e) => setBaseline(e.target.value)}
          />
        </label>
        {reduction !== null && (
          <div className={`notice ${reduction >= 50 ? "notice-success" : "notice-warn"}`}>
            {reduction >= 0
              ? `Waiting time is ${reduction}% lower than the baseline. `
              : `Waiting time is ${Math.abs(reduction)}% higher than the baseline. `}
            {reduction >= 50 ? "The 50% target is met." : "The 50% target is not met yet."}
          </div>
        )}
      </section>

      <section className="card stack">
        <h2>Latest visits</h2>
        {visits.length === 0 ? (
          <p className="muted">No visits in this period.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Patient</th>
                  <th>Status</th>
                  <th>Total time</th>
                </tr>
              </thead>
              <tbody>
                {visits.slice(0, 10).map((v) => (
                  <tr key={v.id}>
                    <td>
                      {fmtDate(
                        new Date(v.slot_time).toLocaleDateString("en-CA", {
                          timeZone: "Asia/Manila",
                        })
                      )}
                    </td>
                    <td>{fmtTime(v.slot_time)}</td>
                    <td>{patientName(v)}</td>
                    <td>
                      <span className={`badge badge-${v.status}`}>{v.status}</span>
                    </td>
                    <td>
                      {v.arrived_at && v.finished_at
                        ? `${minutesBetween(v.arrived_at, v.finished_at)} min`
                        : "-"}
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

export default function AdminPage() {
  return (
    <>
      <div className="stack">
        <h1>Reports</h1>
        <p className="lead">
          The numbers behind the pilot: waiting time, records and dose follow-up.
        </p>
      </div>
      <Guard need="admin">{() => <Reports />}</Guard>
    </>
  );
}
