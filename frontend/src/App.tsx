import { Route, Routes, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import PartnerDashboard from './pages/PartnerDashboard';
import VolunteerDashboard from './pages/VolunteerDashboard';
import ClientScheduler from './pages/ClientScheduler';
import Dashboard from './pages/Dashboard';
import './App.css';

function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">DFS Referral System</div>
        <nav>
          <Link to="/">Partner</Link>
          <Link to="/volunteer">Volunteer</Link>
          <Link to="/client">Client</Link>
          <Link to="/dashboard">Dashboard</Link>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<PartnerDashboard />} />
          <Route path="/volunteer" element={<VolunteerDashboard />} />
          <Route path="/client" element={<ClientScheduler />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          success: {
            style: {
              background: '#06b81b',
              color: '#ffffff',
            },
          },
          error: {
            style: {
              background: '#ff8fc1',
              color: '#000000',
            },
          },
        }}
      />
    </div>
  );
}

export default App;
