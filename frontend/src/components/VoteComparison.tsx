import { useEffect, useRef, useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import type { Track2Issue } from '../types'

type Props = { choices: [Track2Issue, Track2Issue, Track2Issue]; onClose: () => void; onConfirm: (removeId: string) => Promise<boolean> }

export default function VoteComparison({ choices, onClose, onConfirm }: Props) {
  const [firstLoser, setFirstLoser] = useState<Track2Issue | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)
  const busyRef = useRef(busy)
  useEffect(() => { busyRef.current = busy }, [busy])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) { onClose(); return }
      if (e.key !== 'Tab' || !dialog.current) return
      const controls = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]'))
      if (!controls.length) { e.preventDefault(); dialog.current.focus(); return }
      const first = controls[0], last = controls[controls.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('keydown', key); previous?.focus() }
  }, [onClose])
  const pair = firstLoser ? [firstLoser, choices[2]] : choices.slice(0, 2)
  async function confirm() {
    if (!removeId) return
    if (removeId === choices[2].issue_id) { onClose(); return }
    setBusy(true)
    if (!(await onConfirm(removeId))) { setError(true); setBusy(false) }
  }
  return <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
    <div ref={dialog} tabIndex={-1} className="sheet comparison-sheet" role="dialog" aria-modal="true" aria-labelledby="compare-title" onClick={e => e.stopPropagation()}>
      <div className="comparison-header">
        <div><p className="comparison-kicker">YOUR VOTES</p><h2 id="compare-title" className="sheet-title">Choose your priorities</h2></div>
        <button className="icon-button" type="button" disabled={busy} onClick={onClose} aria-label="Close comparison"><X size={22} /></button>
      </div>
      {!removeId ? <>
        <p className="comparison-intro">You have two votes. Choose the issue that matters more to you.</p>
        <p className="comparison-step">Comparison {firstLoser ? '2' : '1'} of 2</p>
        <div className="comparison-choices">{pair.map((item, index) => <button key={item.issue_id} className="comparison-choice" onClick={() => {
          const loser = pair[1 - index]
          if (firstLoser) setRemoveId(loser.issue_id); else setFirstLoser(loser)
        }}><span><strong>{item.request_type.replace(/ Case$/, '')}</strong><span className="comparison-place">{item.address ?? item.local_area}</span></span><ArrowRight size={20} aria-hidden="true" /></button>)}</div>
      </> : <>
        <p className="comparison-intro">Review which issue will be removed. The other two will keep your votes.</p>
        <fieldset className="comparison-review"><legend>Remove vote from</legend>
        {choices.map(i => <label className="comparison-option" key={i.issue_id}>
          <input type="radio" name="remove-vote" checked={removeId === i.issue_id} onChange={() => setRemoveId(i.issue_id)} />
          <span><strong>{i.request_type.replace(/ Case$/, '')}</strong><span className="comparison-place">{i.address ?? i.local_area}{i.issue_id === choices[2].issue_id ? ' · New choice' : ''}</span></span>
        </label>)}</fieldset>
        {error && <p className="form-error" role="alert">Your votes may have changed or the request failed. Close this and try again.</p>}
        <button className="action-button" disabled={busy} onClick={confirm}>Confirm choices</button>
      </>}
      <button className="comparison-cancel" disabled={busy} onClick={onClose}>Cancel</button>
    </div>
  </div>
}
