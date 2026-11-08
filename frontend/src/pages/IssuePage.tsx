import { Globe, List, Navigation } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getTrack2Issue } from "../api/client";
import Discussion from "../components/Discussion";
import DetailHero from "../components/DetailHero";
import ScoreRing from "../components/ScoreRing";
import VoteControl from "../components/VoteControl";
import VotesLeft from "../components/VotesLeft";
import { categoryStyle } from "../data/categories";
import { issueScore, VAN311_URL } from "../lib/issues";
import { useFeed } from "../state/feed";
import type { Track2Issue, Vote } from "../types";

export default function IssuePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { issues, setMyVote, requireSignIn } = useFeed();

  // Opened from the feed: use the issue we already have. Opened from a link: fetch it.
  const cached = issues.items?.find((i) => i.issue_id === id);
  const [fetched, setFetched] = useState<Track2Issue | null | undefined>(undefined); // undefined = loading
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const inFeed = Boolean(cached);
  const lastTap = useRef(0);

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
    requireSignIn("vote", () => {
      if (inFeed) {
        setMyVote(issueId, value);
        return;
      }
      // same guard as the feed: only the latest tap may roll back
      const n = ++lastTap.current;
      const before = fetched?.my_vote ?? 0;
      setFetched((i) => (i ? { ...i, my_vote: value } : i));
      setMyVote(issueId, value).then((ok) => !ok && lastTap.current === n && setFetched((i) => (i ? { ...i, my_vote: before } : i)));
    });
  }

  // "default" means this page was opened directly, not from inside the app
  const goBack = () => (location.key !== "default" ? navigate(-1) : navigate("/issues"));

  return (
    <div className="page place">
      <main className="page-content flush">
        {!issue && <DetailHero title="" place="" onBack={goBack} />}
        {issue === undefined && !error && <div className="skeleton detail-pad" style={{ height: 280 }} aria-busy="true" />}

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
            <DetailHero
              title={issue.request_type.replace(/ Case$/, "")}
              lat={issue.lat}
              lng={issue.lng}
              place={issue.address ?? issue.local_area}
              onBack={goBack}
            />
            <div className="detail-pad">
              <article className="detail">
                <div className="tag-row">
                  <span className="tag-pill">
                    <List size={16} aria-hidden="true" />
                    {categoryStyle(issue.category).label}
                  </span>
                  <span className="tag-pill">
                    <List size={16} aria-hidden="true" />
                    Only the City can fix this
                  </span>
                </div>
                <p className="accent-line">
                  {[categoryStyle(issue.category).label, issue.local_area, `${issue.open_cases} open ${issue.open_cases === 1 ? "case" : "cases"}`].join(" · ")}
                </p>
                <p className="place-line">{issue.address ?? issue.local_area}</p>

                <div className="pill-row">
                  <a className="pill-button" href={VAN311_URL} target="_blank" rel="noopener noreferrer">
                    <Globe size={20} aria-hidden="true" />
                    Van311
                  </a>
                  {issue.lat !== undefined && issue.lng !== undefined && (
                    <a
                      className="pill-button"
                      href={`https://www.google.com/maps/dir/?api=1&destination=${issue.lat},${issue.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Navigation size={20} aria-hidden="true" />
                      Directions
                    </a>
                  )}
                </div>
                <p className="muted small">Van311 is the City's own reporting app. We don't send anything to the City.</p>

                <section className="detail-block" aria-labelledby="scores-heading">
                  <h2 id="scores-heading">Scores</h2>
                  <div className="score-row">
                    <ScoreRing
                      value={Math.round(issueScore(issue).score)}
                      title="Priority"
                      sub="votes, age and reports"
                      badge={issueScore(issue).up}
                    />
                    <ScoreRing
                      value={issue.days_open}
                      title="Days open"
                      sub={issue.days_open >= 14 ? "overdue" : "so far"}
                      tone={issue.days_open >= 14 ? "warn" : "normal"}
                    />
                    <ScoreRing value={issue.times_reported_12m} title="Reports" sub="in the last 12 months" />
                  </div>
                </section>
              </article>

              <Discussion type="issue" id={issue.issue_id} />
            </div>
          </>
        )}
      </main>

      {issue && (
        <div className="action-bar">
          <p className="muted small">Does this affect you? Votes set the order of the list neighbours send to Council.</p>
          <VoteControl issue={issue} onVote={vote} />
          <VotesLeft />
        </div>
      )}
    </div>
  );
}
