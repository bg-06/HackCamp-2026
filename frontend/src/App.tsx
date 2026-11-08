import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import SignInPrompt from './components/SignInPrompt'
import HomePage from './pages/HomePage'
import IssuePage from './pages/IssuePage'
import NewEventPage from './pages/NewEventPage'
import ProfilePage from './pages/ProfilePage'
import VolunteerPage from './pages/VolunteerPage'
import FeedProvider from './state/FeedProvider'

// Keyed by id: going from one card's page to another starts fresh, with nothing left over from the last one.
function VolunteerRoute() {
  const { id = '' } = useParams()
  return <VolunteerPage key={id} />
}
function IssueRoute() {
  const { id = '' } = useParams()
  return <IssuePage key={id} />
}

// Old links (/events/:id, /fix) still work.
function OldEventLink() {
  const { id = '' } = useParams()
  return <Navigate to={`/volunteer/${encodeURIComponent(id)}`} replace />
}

export default function App() {
  return (
    <FeedProvider>
      <div className="app">
        <Routes>
          {/* "/" is Volunteer (Track 1), "/issues" is Issues (Track 2). Lists, location, sort and scroll live
              in FeedProvider, so they survive opening a card and coming back. */}
          <Route path="/:tab?" element={<HomePage />} />
          <Route path="/volunteer/new" element={<NewEventPage />} />
          <Route path="/volunteer/:id" element={<VolunteerRoute />} />
          <Route path="/issues/:id" element={<IssueRoute />} />
          <Route path="/events/:id" element={<OldEventLink />} />
          <Route path="/fix" element={<Navigate to="/issues" replace />} />
          <Route path="/me" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <BottomNav />
        <SignInPrompt />
      </div>
    </FeedProvider>
  )
}
