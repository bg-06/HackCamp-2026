import { ChevronLeft, TriangleAlert } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { createEvent, getSuggestions, type Suggestion } from "../api/client";
import { describeReports, hotspotKind } from "../lib/hotspots";
import { VAN311_URL } from "../lib/issues";
import { useFeed } from "../state/feed";
import type { HelpHotspot, NewEvent } from "../types";

const TZ = "America/Vancouver";
// BC is on UTC-7 all year from Nov 2026 (no more fall-back), so a Vancouver wall time is always -07:00
const VANCOUVER_OFFSET = "-07:00";
const CLEANUP_SUPPLIES_URL = "https://vancouver.ca/people-programs/neighbourhood-cleanup-party.aspx";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const vancouverDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD

// The next Saturday, in Vancouver. (Not parsed back from toLocaleString: Safari can't read that.)
function nextSaturday() {
  const now = new Date();
  const weekday = WEEKDAYS.indexOf(now.toLocaleDateString("en-US", { timeZone: TZ, weekday: "short" }));
  const days = (6 - weekday + 7) % 7 || 7;
  return vancouverDate(new Date(now.getTime() + days * 86400000));
}

function defaultTitle(h: HelpHotspot) {
  const where = h.near ?? h.local_area;
  // Volunteers can't paint over graffiti on City or park property: walk, log each tag, report it.
  return hotspotKind(h.request_type, h.category).action === "walk" ? `Graffiti walk near ${where}` : `Cleanup near ${where}`;
}

export default function NewEventPage() {
  const [params] = useSearchParams();
  const hotspotId = params.get("hotspot") ?? "";
  const suggestionId = params.get("suggestion") ?? "";
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [suggestionLoaded, setSuggestionLoaded] = useState(!suggestionId);
  useEffect(() => {
    if (!suggestionId) return;
    let active = true;
    getSuggestions().then(items => { if (active) setSuggestion(items.find(s => s.id === suggestionId) ?? null); })
      .catch(() => { if (active) setSuggestion(null); }).finally(() => { if (active) setSuggestionLoaded(true); });
    return () => { active = false; };
  }, [suggestionId]);
  const { hotspots } = useFeed();
  const draftHotspot = suggestion?.payload.event_draft.hotspot_id.replace(/^([^:|]+):/, "$1|");
  const hotspot = hotspots.items?.find((h) => h.id === (suggestionId ? draftHotspot : hotspotId));

  return (
    <div className="page">
      <Header />
      <main className="page-content">
        {!hotspots.items && !hotspots.error && <div className="skeleton" style={{ height: 320 }} aria-busy="true" />}
        {suggestionId && suggestionLoaded && !suggestion && <p className="form-error">This suggestion is unavailable. Sign in with an approved organization account and try again.</p>}
        {suggestionLoaded && (!suggestionId || suggestion) && (hotspots.error || (hotspots.items && !hotspot)) && (
          <div className="empty">
            <p>Pick a spot from "Needs help" to start an event there.</p>
            <Link className="chip-button" to="/">
              Back to Volunteer
            </Link>
          </div>
        )}
        {/* Dumped items need a City pickup (and may be someone's belongings), so no cleanup event. */}
        {hotspot && hotspotKind(hotspot.request_type, hotspot.category).action === "report" && (
          <div className="empty">
            <p>Dumped items here need a City pickup, and some things left out may belong to someone. Report it instead of planning a cleanup.</p>
            <a className="chip-button" href={VAN311_URL} target="_blank" rel="noopener noreferrer">
              Report in Van311 ↗
            </a>
          </div>
        )}
        {/* keyed so the form starts fresh if the spot changes */}
        {hotspot && suggestionLoaded && (!suggestionId || suggestion) && hotspotKind(hotspot.request_type, hotspot.category).action !== "report" && (
          <EventForm key={hotspot.id + suggestionId} hotspot={hotspot} suggestion={suggestion} />
        )}
      </main>
    </div>
  );
}

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <header className="home-header">
      <div className="top-bar">
        <button className="icon-button" onClick={() => (location.key !== "default" ? navigate(-1) : navigate("/"))} aria-label="Back">
          <ChevronLeft size={24} />
        </button>
        <p className="header-title">Start an event</p>
        <span aria-hidden="true" />
      </div>
    </header>
  );
}

function EventForm({ hotspot, suggestion }: { hotspot: HelpHotspot; suggestion: Suggestion | null }) {
  const navigate = useNavigate();
  const { addEvent, requireSignIn } = useFeed();

  const walk = hotspotKind(hotspot.request_type, hotspot.category).action === "walk";
  const [title, setTitle] = useState(() => walk ? defaultTitle(hotspot) : suggestion?.payload.event_draft.title ?? defaultTitle(hotspot));
  const [today] = useState(() => vancouverDate(new Date()));
  const [date, setDate] = useState(nextSaturday);
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("12:00");
  const [location, setLocation] = useState(hotspot.near ?? hotspot.local_area);
  const [spots, setSpots] = useState("10");
  const [bring, setBring] = useState(walk ? "A phone to photograph and report each tag" : suggestion?.payload.event_draft.what_to_bring ?? "Work gloves");
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function publish(input: NewEvent) {
    setSaving(true);
    try {
      const e = await createEvent(input);
      addEvent(e);
      navigate(`/volunteer/${encodeURIComponent(e.id)}`, { replace: true });
    } catch {
      setProblem("Couldn't publish it. Check your connection and try again.");
      setSaving(false);
    }
  }

  // Check the form first, so nobody signs in only to be told the time is wrong
  function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const startsAt = `${date}T${start}:00${VANCOUVER_OFFSET}`;
    const endsAt = `${date}T${end}:00${VANCOUVER_OFFSET}`;
    const spotsTotal = Number(spots);
    if (!title.trim() || !location.trim()) return setProblem("Add a title and a place.");
    if (Number.isNaN(Date.parse(startsAt)) || Date.parse(startsAt) <= Date.now()) return setProblem("Pick a time that hasn't passed yet.");
    if (Date.parse(endsAt) <= Date.parse(startsAt)) return setProblem("The end time needs to be after the start.");
    if (!Number.isInteger(spotsTotal) || spotsTotal < 1 || spotsTotal > 100) return setProblem("Spots should be a number from 1 to 100.");
    setProblem(null);

    const input: NewEvent = {
      hotspotId: hotspot.id,
      suggestionId: suggestion?.id,
      title: title.trim(),
      startsAt,
      endsAt,
      location: location.trim(),
      localArea: hotspot.local_area,
      category: hotspot.category,
      spotsTotal,
      whatToBring: bring.trim() || undefined,
      lat: hotspot.lat,
      lng: hotspot.lng,
      hotspot: { requestType: hotspot.request_type, timesReported: hotspot.times_reported, monthsSeen: hotspot.months_seen },
    };
    requireSignIn("start an event", () => publish(input));
  }

  return (
    <form className="event-form" onSubmit={submit}>
      <p className="why-here">
        {hotspotKind(hotspot.request_type, hotspot.category).label} here: {describeReports(hotspot.times_reported, Math.min(12, hotspot.months_seen))}.
      </p>

      <label>
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
      </label>
      <label>
        <span>Where to meet</span>
        <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} required />
      </label>
      <div className="form-row">
        <label>
          <span>Date</span>
          <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          <span>From</span>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
        </label>
        <label>
          <span>To</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </label>
      </div>
      <label>
        <span>Spots</span>
        <input type="number" inputMode="numeric" min={1} max={100} value={spots} onChange={(e) => setSpots(e.target.value)} required />
      </label>
      <label>
        <span>What to bring (optional)</span>
        <input value={bring} onChange={(e) => setBring(e.target.value)} maxLength={120} />
      </label>

      {walk ? (
        <p className="muted small">
          Walk the block together, photograph each tag and report it in Van311. Please don't paint over City or park
          property; City crews remove it.{" "}
          <a className="text-link" href={VAN311_URL} target="_blank" rel="noopener noreferrer">
            Van311 ↗
          </a>
        </p>
      ) : (
        <p className="muted small">
          The City lends gloves, bags and grabbers for neighbourhood cleanups. Leave anything that might belong to someone.{" "}
          <a className="text-link" href={CLEANUP_SUPPLIES_URL} target="_blank" rel="noopener noreferrer">
            Request supplies ↗
          </a>
        </p>
      )}

      {problem && (
        <p className="form-error" role="alert">
          <TriangleAlert size={16} aria-hidden="true" />
          {problem}
        </p>
      )}
      <button className="action-button" type="submit" disabled={saving}>
        {saving ? "Publishing…" : "Publish"}
      </button>
      <p className="muted small">It shows up on Volunteer straight away, and you're signed up as the host.</p>
    </form>
  );
}
