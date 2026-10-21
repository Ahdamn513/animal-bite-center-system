"use client";

import { useEffect, useState } from "react";
import Guard from "@/components/Guard";
import { supabase } from "@/lib/supabase";
import {
  DOSE_DAYS,
  daysBetween,
  doseState,
  fmtDate,
  todayManila,
  type Dose,
} from "@/lib/helpers";

function Doses({ userId }: { userId: string }) {
  const [doses, setDoses] = useState<Dose[] | null>(null);
  const today = todayManila();

  useEffect(() => {
    let active = true;
    supabase
      .from("vaccine_doses")
      .select("*")
      .eq("patient_id", userId)
      .order("dose_number")
      .then(({ data }) => {
        if (active) setDoses((data ?? []) as Dose[]);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  if (doses === null) return <p className="muted">Loading your schedule</p>;

  if (doses.length === 0) {
    return (
      <div className="notice">
        Your schedule appears here after staff start your vaccine course at your
        first visit.
      </div>
    );
  }

  const dueNow = doses.find((d) => !d.given_at && d.scheduled_date <= today);
  const next = doses.find((d) => !d.given_at && d.scheduled_date > today);

  return (
    <>
      {dueNow ? (
        <div className="notice notice-warn">
          {dueNow.scheduled_date === today
            ? "Your next dose is due today. Please come to the center."
            : `Your dose from ${fmtDate(dueNow.scheduled_date)} was missed. Please go to the center as soon as you can and tell the staff.`}
        </div>
      ) : next ? (
        <div className="notice">
          Your next dose is in {daysBetween(today, next.scheduled_date)} day
          {daysBetween(today, next.scheduled_date) === 1 ? "" : "s"}, on{" "}
          {fmtDate(next.scheduled_date)}.
        </div>
      ) : (
        <div className="notice notice-success">
          All scheduled doses are done. Well done for finishing the course.
        </div>
      )}

      <section className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Dose</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {doses.map((d) => {
              const state = doseState(d, today);
              return (
                <tr key={d.id}>
                  <td>
                    Dose {d.dose_number} (Day {DOSE_DAYS[d.dose_number - 1] ?? "?"})
                  </td>
                  <td>{fmtDate(d.scheduled_date)}</td>
                  <td>
                    <span className={`badge badge-${state}`}>
                      {state === "given"
                        ? "Given"
                        : state === "due"
                          ? "Due today"
                          : state === "missed"
                            ? "Missed"
                            : "Upcoming"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <p className="muted">
        Dates follow the standard four-visit schedule. Staff may change them
        for your case, so always follow what the center tells you.
      </p>
    </>
  );
}

export default function MyDosesPage() {
  return (
    <>
      <div className="stack">
        <h1>My vaccine schedule</h1>
        <p className="lead">Know when to come back so no dose is missed.</p>
      </div>
      <Guard>{({ userId }) => <Doses userId={userId} />}</Guard>
    </>
  );
}
