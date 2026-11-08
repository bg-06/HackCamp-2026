import { Navigate, Route, Routes } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import EventPage from './pages/EventPage'
import ForumPage from './pages/ForumPage'
import ForumThreadPage from './pages/ForumThreadPage'
import HomePage from './pages/HomePage'
import PlaceholderPage from './pages/PlaceholderPage'

export default function App() {
  return (
    <div className="app">
      <Routes>
        {/* "/" is the Events tab (Track 1), "/fix" is the Issues tab (Track 2). One route, so switching
            tabs keeps the page (and your votes and RSVPs) instead of reloading it. */}
        <Route path="/:tab?" element={<HomePage />} />
        <Route path="/events/:id" element={<EventPage />} />
        <Route path="/forum" element={<ForumPage />} />
        <Route path="/forum/:id" element={<ForumThreadPage />} />
        <Route
          path="/map"
          element={<PlaceholderPage title="Map" text="A map of 311 hotspots: green where neighbours can help, blue where only the City can fix it." />}
        />
        <Route
          path="/me"
          element={<PlaceholderPage title="Profile" text="Your RSVPs, past events, volunteer hours and votes will show up here." />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}
