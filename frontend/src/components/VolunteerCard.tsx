import { KIND_LABELS } from '../data/categories'
import { requestTypeInSentence } from '../lib/cover'
import type { VolunteerEvent } from '../types'

const TZ = 'America/Vancouver'

// "Sat, Nov 15, 10:00am–12:00pm", always in Vancouver time.
function formatWhen(startsAt: string | null, endsAt: string | null) {
  if (!startsAt) return 'Ongoing program'
  const day = new Date(startsAt).toLocaleDateString('en-CA', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' })
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase()
  return endsAt ? `${day}, ${time(startsAt)}–${time(endsAt)}` : `${day}, ${time(startsAt)}`
}

// The details. The sign-up button is in VolunteerAction, pinned to the bottom of the page.
export default function VolunteerCard({ event }: { event: VolunteerEvent }) {
  const total = event.spotsTotal
  const taken = (event.spotsTaken ?? 0) + (event.going ? 1 : 0)
  const left = total !== undefined ? Math.max(total - taken, 0) : 0

  return (
    <article className="detail">
      {event.photoUrl && <img className="detail-photo" src={event.photoUrl} alt="" />}

      <p className="eyebrow">
        {KIND_LABELS[event.kind].label}
        {event.sample && ' · Sample listing'}
      </p>
      <h1>{event.title}</h1>
      <p className="muted">{event.organiser}</p>

      <dl className="facts">
        <dt>When</dt>
        <dd>{formatWhen(event.startsAt, event.endsAt)}</dd>
        {event.whatToBring && (
          <>
            <dt>Bring</dt>
            <dd>{event.whatToBring}</dd>
          </>
        )}
      </dl>

      {event.hotspot && (
        <p className="why-here">
          {requestTypeInSentence(event.hotspot.requestType)} has been reported here {event.hotspot.timesReported} times in the last{' '}
          {event.hotspot.monthsSeen} months.
        </p>
      )}

      {!event.signupUrl && total !== undefined && (
        <div className="spots">
          <p>
            {taken} of {total} signed up · {taken >= total ? 'full' : `${left} ${left === 1 ? 'spot' : 'spots'} left`}
          </p>
          <progress value={Math.min(taken, total)} max={total} aria-label={`${taken} of ${total} spots taken`} />
        </div>
      )}
    </article>
  )
}
