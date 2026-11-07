import { Navigate, Route, Routes } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import HomePage from './pages/HomePage'
import PlaceholderPage from './pages/PlaceholderPage'

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/updates"
          element={<PlaceholderPage title="Updates" text="Weekly neighbourhood briefings and City news will show up here." />}
        />
        <Route
          path="/map"
          element={<PlaceholderPage title="Map" text="A live map of 311 hotspots across Vancouver is coming next." />}
        />
        <Route
          path="/profile"
          element={<PlaceholderPage title="Profile" text="Your reports, your neighbourhood, and the events you joined." />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}
