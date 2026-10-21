import Link from "next/link";

export default function Home() {
  return (
    <>
      <section className="stack" style={{ gap: "1rem" }}>
        <h1>Book your visit. Watch your place in line from home.</h1>
        <p className="lead">
          BiteQueue helps animal bite patients and bite-center staff replace
          the early-morning scramble with time slots, a live queue and a
          vaccine schedule that reminds you when to return.
        </p>
        <div className="row">
          <Link className="btn btn-primary" href="/book">
            Book a slot
          </Link>
          <Link className="btn" href="/queue">
            See the queue
          </Link>
        </div>
      </section>

      <section className="notice notice-warn stack">
        <h2>Just got bitten or scratched?</h2>
        <p>
          Wash the wound thoroughly with soap and running water, then go to the
          nearest animal bite center. A health worker will decide what
          treatment you need.
        </p>
      </section>

      <section className="grid-cards">
        <Link href="/book" className="link-card">
          <h3>Book a slot</h3>
          <p>Pick a day and time instead of arriving hours early.</p>
        </Link>
        <Link href="/queue" className="link-card">
          <h3>Live queue</h3>
          <p>See who is being served and how many are ahead of you.</p>
        </Link>
        <Link href="/my-doses" className="link-card">
          <h3>My vaccine schedule</h3>
          <p>Check your next visit date so no dose is missed.</p>
        </Link>
        <Link href="/faq" className="link-card">
          <h3>Ask a question</h3>
          <p>Get general answers in English or Filipino.</p>
        </Link>
      </section>
    </>
  );
}
