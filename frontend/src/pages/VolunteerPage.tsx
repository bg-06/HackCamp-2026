import { ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getVolunteerEvent } from "../api/client";
import Discussion from "../components/Discussion";
import PlaceSection from "../components/PlaceSection";
import VolunteerAction from "../components/VolunteerAction";
import VolunteerCard from "../components/VolunteerCard";
import { useFeed } from "../state/feed";
import type { VolunteerEvent } from "../types";

export default function VolunteerPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { events, setGoing, requireSignIn } = useFeed();

  // Opened from the feed: use what we already have. Opened from a link: fetch it.
  const cached = events.items?.find((e) => e.id === id);
  const [fetched, setFetched] = useState<VolunteerEvent | null | undefined>(undefined); // undefined = loading
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const inFeed = Boolean(cached);
  const lastTap = useRef(0);

  useEffect(() => {
    if (inFeed) return;
    let cancelled = false;
    getVolunteerEvent(id)
      .then((e) => !cancelled && setFetched(e))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [id, inFeed, reloadKey]);

  const event = cached ?? fetched;

  function toggleGoing() {
    if (!event) return;
    const on = !event.going;
    requireSignIn("sign up", () => {
      // same guard as the feed: only the latest tap may roll back
      const n = ++lastTap.current;
      if (!inFeed) setFetched((e) => (e ? { ...e, going: on } : e));
      setGoing(event.id, on).then((ok) => !ok && !inFeed && lastTap.current === n && setFetched((e) => (e ? { ...e, going: !on } : e)));
    });
  }

  // "default" means this page was opened directly, not from inside the app
  const goBack = () => (location.key !== "default" ? navigate(-1) : navigate("/"));

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

        {error && !event && (
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
            <VolunteerCard event={event} />
            <PlaceSection lat={event.lat} lng={event.lng} label={`${event.location}, ${event.localArea}`} />
            <Discussion type="event" id={event.id} />
          </>
        )}
      </main>

      {event && (
        <div className="action-bar">
          <VolunteerAction event={event} onToggleGoing={toggleGoing} />
        </div>
      )}
    </div>
  );
}
