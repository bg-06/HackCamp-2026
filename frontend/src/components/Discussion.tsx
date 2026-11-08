import { TriangleAlert } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { addComment, getComments } from '../api/client'
import { AUTHOR_BADGES, COMMENT_MAX, formatPosted } from '../lib/comments'
import type { Comment, CommentTarget } from '../types'

interface Props {
  type: CommentTarget
  id: string
}

export default function Discussion({ type, id }: Props) {
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(false)

  useEffect(() => {
    let cancelled = false
    getComments(type, id)
      .then((c) => !cancelled && setComments(c))
      .catch(() => !cancelled && setLoadError(true))
    return () => {
      cancelled = true
    }
  }, [type, id, reloadKey])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setSendError(false)
    try {
      const c = await addComment(type, id, body)
      setComments((prev) => [...(prev ?? []), c])
      setText('')
    } catch {
      setSendError(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="detail-section" aria-labelledby="discussion-heading">
      <h2 id="discussion-heading">Discussion{comments && comments.length > 0 ? ` (${comments.length})` : ''}</h2>

      {loadError && (
        <p className="form-error" role="alert">
          <TriangleAlert size={16} aria-hidden="true" />
          Couldn't load comments.{' '}
          <button
            className="link-button"
            onClick={() => {
              setLoadError(false)
              setReloadKey((k) => k + 1)
            }}
          >
            Try again
          </button>
        </p>
      )}

      {comments && comments.length === 0 && <p className="muted">No comments yet. Ask a question or offer to help.</p>}

      {comments && comments.length > 0 && (
        <ul className="comment-list">
          {comments.map((c) => {
            const badge = AUTHOR_BADGES[c.authorKind]
            return (
              <li key={c.id} className="comment">
                <p className="comment-meta">
                  <strong>{c.author}</strong>
                  {badge && <span> · {badge}</span>}
                  <span> · {formatPosted(c.createdAt)}</span>
                </p>
                <p className="comment-body">{c.body}</p>
              </li>
            )
          })}
        </ul>
      )}

      {/* No form until the list has loaded, so a new comment never looks like the only one */}
      {comments && (
        <form className="comment-form" onSubmit={submit}>
          <label className="visually-hidden" htmlFor={`comment-${id}`}>
            Write a comment
          </label>
          <textarea
            id={`comment-${id}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={COMMENT_MAX}
            rows={2}
            placeholder="Write a comment"
          />
          {sendError && (
            <p className="form-error" role="alert">
              <TriangleAlert size={16} aria-hidden="true" />
              Couldn't post your comment. Try again.
            </p>
          )}
          <button className="action-button secondary" type="submit" disabled={sending || !text.trim()}>
            {sending ? 'Posting…' : 'Post'}
          </button>
          <p className="muted small">Comments are public. Don't share anyone's personal details.</p>
        </form>
      )}
    </section>
  )
}
