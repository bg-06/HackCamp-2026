import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getTrack2Issue } from "../api/client";
import Discussion from "../components/Discussion";
import PlaceSection from "../components/PlaceSection";
import VoteControl from "../components/VoteControl";
import { categoryStyle } from "../data/categories";
import { VAN311_URL } from "../lib/issues";
import { useFeed } from "../state/feed";
import type { Track2Issue, Vote } from "../types";

export default function IssuePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { issues, setMyVote } = useFeed();

  // Opened from the feed: use the issue we already have. Opened from a link: fetch it.
  const cached = issues.items?.find((i) => i.issue_id === id);
  const [fetched, setFetched] = useState<Track2Issue | null | undefined>(undefined); // undefined = loading
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const inFeed = Boolean(cached);

  useEffect(() => {
    if (inFeed) return;
    let cancelled = false;
    getTrack2Issue(id)
      .then((i) => !cancelled && setFetched(i))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [id, inFeed, reloadKey]);

  const issue = cached ?? fetched;

  function vote(issueId: string, value: Vote) {
    if (inFeed) {
      setMyVote(issueId, value);
      return;
    }
    const before = fetched?.my_vote ?? 0;
    setFetched((i) => (i ? { ...i, my_vote: value } : i));
    setMyVote(issueId, value).then((ok) => !ok && setFetched((i) => (i ? { ...i, my_vote: before } : i)));
  }

  // "default" means this page was opened directly, not from inside the app
  const goBack = () => (location.key !== "default" ? navigate(-1) : navigate("/issues"));

  return (
    <div className="page">
      <header className="home-header track-issues">
        <div className="top-bar">
          <button className="icon-button" onClick={goBack} aria-label="Back">
            <ChevronLeft size={24} />
          </button>
          <p className="header-title">Issue</p>
          <span aria-hidden="true" />
        </div>
      </header>

      <main className="page-content">
        {issue === undefined && !error && <div className="skeleton" style={{ height: 280 }} aria-busy="true" />}

        {error && !issue && (
          <div className="empty" role="alert">
            <p>Couldn't load this issue. Check your connection and try again.</p>
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

        {issue === null && (
          <div className="empty">
            <p>This issue isn't open any more. The City may have closed it.</p>
            <Link className="chip-button" to="/issues">
              Back to Issues
            </Link>
          </div>
        )}

        {issue && (
          <>
            <article className="detail">
              {issue.photo_url && <img className="detail-photo" src={issue.photo_url} alt="" />}
              <p className="eyebrow">{categoryStyle(issue.category).label} · Only the City can fix this</p>
              <h1>{issue.request_type.replace(/ Case$/, "")}</h1>
              <p className="muted">{issue.address ?? issue.local_area}</p>

              <dl className="facts">
                <dt>Open for</dt>
                <dd className={issue.days_open >= 14 ? "overdue" : ""}>
                  {issue.days_open} {issue.days_open === 1 ? "day" : "days"}
                </dd>
                <dt>Reported</dt>
                <dd>
                  {issue.times_reported_12m} {issue.times_reported_12m === 1 ? "time" : "times"} in the last 12 months
                </dd>
                <dt>Open cases</dt>
                <dd>{issue.open_cases}</dd>
              </dl>

              <p className="muted small">Does this affect you? Votes decide the order of the list neighbours send to Council.</p>
              <VoteControl issue={issue} onVote={vote} />

              <div className="card-action">
                <a className="action-button secondary" href={VAN311_URL} target="_blank" rel="noopener noreferrer">
                  Report it in Van311 ↗
                </a>
                <p className="muted small">Van311 is the City's own reporting app. We don't send anything to the City.</p>
              </div>
            </article>

            <PlaceSection lat={issue.lat} lng={issue.lng} label={issue.address ?? issue.local_area} />
            <Discussion type="issue" id={issue.issue_id} />
          </>
        )}
      </main>
    </div>
  );
}
