import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import HomePage from './pages/HomePage'
import IssuePage from './pages/IssuePage'
import PlaceholderPage from './pages/PlaceholderPage'
import VolunteerPage from './pages/VolunteerPage'

// Old links (/events/:id, /fix) still work.
function OldEventLink() {
  const { id = '' } = useParams()
  return <Navigate to={`/volunteer/${encodeURIComponent(id)}`} replace />
}

export default function App() {
  return (
    <div className="app">
      <Routes>
        {/* "/" is Volunteer (Track 1), "/issues" is Issues (Track 2). One route, so switching between them
            keeps the page (your location and sort) instead of starting over. */}
        <Route path="/:tab?" element={<HomePage />} />
        <Route path="/volunteer/:id" element={<VolunteerPage />} />
        <Route path="/issues/:id" element={<IssuePage />} />
        <Route path="/events/:id" element={<OldEventLink />} />
        <Route path="/fix" element={<Navigate to="/issues" replace />} />
        <Route
          path="/me"
          element={<PlaceholderPage title="Profile" text="Where you've signed up to help, your volunteer hours and your votes will show up here." />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}
