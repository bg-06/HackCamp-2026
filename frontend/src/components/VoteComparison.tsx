import { useEffect, useRef, useState } from 'react'
import type { Track2Issue } from '../types'

type Props = { choices: [Track2Issue, Track2Issue, Track2Issue]; onClose: () => void; onConfirm: (removeId: string) => Promise<boolean> }

export default function VoteComparison({ choices, onClose, onConfirm }: Props) {
  const [firstLoser, setFirstLoser] = useState<Track2Issue | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.focus()
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('keydown', key); previous?.focus() }
  }, [onClose])
  const label = (i: Track2Issue) => `${i.request_type.replace(/ Case$/, '')} — ${i.address ?? i.local_area}`
  const pair = firstLoser ? [firstLoser, choices[2]] : choices.slice(0, 2)
  async function confirm() {
    if (!removeId) return
    if (removeId === choices[2].issue_id) { onClose(); return }
    setBusy(true)
    if (!(await onConfirm(removeId))) { setError(true); setBusy(false) }
  }
  return <div className="sheet-backdrop" onClick={onClose}>
    <div ref={dialog} tabIndex={-1} className="sheet" role="dialog" aria-modal="true" aria-labelledby="compare-title" onClick={e => e.stopPropagation()}>
      <h2 id="compare-title" className="sheet-title">Choose your priorities</h2>
      {!removeId ? <>
        <p>You can prioritize two issues. Which is more pressing to you? {firstLoser ? '(2 of 2)' : '(1 of 2)'}</p>
        <div className="sheet-actions">{pair.map((item, index) => <button key={item.issue_id} className="action-button secondary" onClick={() => {
          const loser = pair[1 - index]
          if (firstLoser) setRemoveId(loser.issue_id); else setFirstLoser(loser)
        }}>{label(item)}</button>)}</div>
        <button className="link-button" onClick={() => setRemoveId(choices[2].issue_id)}>Choose directly instead</button>
      </> : <>
        <p>Choose the issue to remove. The other two will keep your votes.</p>
        {choices.map(i => <label key={i.issue_id} style={{ display: 'block', margin: '12px 0' }}>
          <input type="radio" name="remove-vote" checked={removeId === i.issue_id} onChange={() => setRemoveId(i.issue_id)} /> {label(i)}{i.issue_id === choices[2].issue_id ? ' (new choice)' : ''}
        </label>)}
        {error && <p className="form-error" role="alert">Your votes may have changed or the request failed. Close this and try again.</p>}
        <button className="action-button" disabled={busy} onClick={confirm}>Confirm choices</button>
      </>}
      <button className="action-button secondary" disabled={busy} onClick={onClose}>Cancel</button>
    </div>
  </div>
}
