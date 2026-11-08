import { ArrowUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

const SHOW_AFTER = 400 // px scrolled before the button appears

// Floating "back to top" button for whichever .page-content is scrolling. Works on every page without
// each page wiring it up: scroll events don't bubble, but they can be caught on the way down.
export default function JumpToTop() {
  const { pathname } = useLocation()
  const [scroller, setScroller] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const onScroll = (e: Event) => {
      const el = e.target
      if (!(el instanceof HTMLElement) || !el.classList.contains('page-content')) return
      setScroller(el.scrollTop > SHOW_AFTER ? el : null)
    }
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => document.removeEventListener('scroll', onScroll, { capture: true })
  }, [])

  // New page: start hidden; the page's own scroll (or a restored position) brings it back.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('.page-content')
    setScroller(el && el.scrollTop > SHOW_AFTER ? el : null)
  }, [pathname])

  if (!scroller) return null
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <button type="button" className="jump-to-top" aria-label="Back to top" onClick={() => scroller.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })}>
      <ArrowUp size={20} aria-hidden="true" />
    </button>
  )
}
