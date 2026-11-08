import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getVolunteerEvent, setGoing } from "../api/client";
import Discussion from "../components/Discussion";
import PlaceSection from "../components/PlaceSection";
import VolunteerCard from "../components/VolunteerCard";
import type { VolunteerEvent } from "../types";

/** One way to volunteer: the details and sign-up, where it is, and the discussion. */
export default function VolunteerPage() {
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

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));

  return (
    <div className="page">
      <header className="home-header">
        <div className="top-bar">
          <button className="icon-button" onClick={goBack} aria-label="Back">
            <ChevronLeft size={24} />
          </button>
          <p className="header-title">Volunteer</p>
          <span aria-hidden="true" />
        </div>
      </header>

      <main className="page-content">
        {event === undefined && !error && <div className="skeleton" style={{ height: 320 }} aria-busy="true" />}

        {error && (
          <div className="empty" role="alert">
            <p>Couldn't load this. Check your connection and try again.</p>
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
            <p>This doesn't exist any more, or was removed.</p>
            <Link className="chip-button" to="/">
              Back to Volunteer
            </Link>
          </div>
        )}

        {event && (
          <>
            <VolunteerCard event={event} going={Boolean(event.going)} onToggleGoing={toggleGoing} />
            <PlaceSection lat={event.lat} lng={event.lng} label={`${event.location}, ${event.localArea}`} />
            <Discussion type="event" id={event.id} />
          </>
        )}
      </main>
    </div>
  );
}
