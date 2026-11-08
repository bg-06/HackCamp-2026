import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getVolunteerEvent, setGoing } from "../api/client";
import VolunteerCard from "../components/VolunteerCard";
import type { VolunteerEvent } from "../types";

/** Everything about one event: the full card from before, with the RSVP or sign-up button. */
export default function EventPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<VolunteerEvent | null | undefined>(undefined); // undefined = loading
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getVolunteerEvent(id)
      .then((e) => !cancelled && setEvent(e))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  // Update the button right away, then tell the backend. Undo if the request fails.
  function toggleGoing() {
    if (!event) return;
    const on = !event.going;
    setEvent({ ...event, going: on });
    setGoing(event.id, on).catch(() => setEvent((e) => (e ? { ...e, going: !on } : e)));
  }

  // Back to wherever you came from (Home or a forum thread); straight to Home if opened from a link.
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));

  return (
    <div className="page">
      <header className="home-header">
        <div className="top-bar">
          <button className="icon-button" onClick={goBack} aria-label="Back">
            <ChevronLeft size={24} />
          </button>
          <h1 className="header-title">Event</h1>
          <span aria-hidden="true" />
        </div>
      </header>

      <main className="page-content">
        {event === undefined && !error && <div className="post-card skeleton" style={{ height: 420 }} aria-busy="true" />}

        {error && (
          <div className="empty" role="alert">
            <p>Couldn't load this event. Check your connection and try again.</p>
            <button
              className="chip-button"
              onClick={() => {
                setError(false);
                setReloadKey((k) => k + 1);
              }}
            >
              Try again
            </button>
          </div>
        )}

        {event === null && (
          <div className="empty">
            <p>This event doesn't exist or was removed.</p>
            <Link className="chip-button" to="/">
              Back to Home
            </Link>
          </div>
        )}

        {event && <VolunteerCard event={event} going={Boolean(event.going)} onToggleGoing={toggleGoing} />}
      </main>
    </div>
  );
}
