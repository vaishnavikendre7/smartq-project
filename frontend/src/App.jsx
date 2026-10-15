import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from './layouts/MainLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { dashboardPath } from './lib/format.js';

import Landing from './pages/public/Landing.jsx';
import About from './pages/public/About.jsx';
import Offices from './pages/public/Offices.jsx';
import OfficeDetail from './pages/public/OfficeDetail.jsx';
import Services from './pages/public/Services.jsx';
import Login from './pages/public/Login.jsx';
import Register from './pages/public/Register.jsx';
import Display from './pages/public/Display.jsx';
import NotFound from './pages/public/NotFound.jsx';

import CitizenDashboard from './pages/citizen/CitizenDashboard.jsx';
import BookToken from './pages/citizen/BookToken.jsx';
import MyTokens from './pages/citizen/MyTokens.jsx';
import TokenDetail from './pages/citizen/TokenDetail.jsx';
import Applications from './pages/citizen/Applications.jsx';
import ApplicationNew from './pages/citizen/ApplicationNew.jsx';
import ApplicationDetail from './pages/citizen/ApplicationDetail.jsx';
import Notifications from './pages/citizen/Notifications.jsx';
import Complaints from './pages/citizen/Complaints.jsx';
import ComplaintDetail from './pages/citizen/ComplaintDetail.jsx';
import Profile from './pages/citizen/Profile.jsx';

import OfficerDashboard from './pages/officer/OfficerDashboard.jsx';
import VerifyToken from './pages/officer/VerifyToken.jsx';
import OfficerApplicationDetail from './pages/officer/OfficerApplicationDetail.jsx';
import ApplicationsList from './pages/shared/ApplicationsList.jsx';
import StaffComplaints from './pages/shared/StaffComplaints.jsx';
import StaffComplaintDetail from './pages/shared/StaffComplaintDetail.jsx';

import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import ManageOffices from './pages/admin/ManageOffices.jsx';
import ManageServices from './pages/admin/ManageServices.jsx';
import ManageOfficers from './pages/admin/ManageOfficers.jsx';
import AdminTokens from './pages/admin/AdminTokens.jsx';
import Logs from './pages/admin/Logs.jsx';

// Logged-in users who open /login or /register are sent to their own dashboard
function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to={dashboardPath(user.role)} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        {/* public pages */}
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<About />} />
        <Route path="/offices" element={<Offices />} />
        <Route path="/offices/:id" element={<OfficeDetail />} />
        <Route path="/services" element={<Services />} />
        <Route path="/display" element={<Display />} />
        <Route path="/display/:officeId" element={<Display />} />
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />

        {/* citizen pages */}
        <Route element={<ProtectedRoute roles={['CITIZEN']} />}>
          <Route path="/citizen" element={<CitizenDashboard />} />
          <Route path="/citizen/book" element={<BookToken />} />
          <Route path="/citizen/tokens" element={<MyTokens />} />
          <Route path="/citizen/tokens/:id" element={<TokenDetail />} />
          <Route path="/citizen/applications" element={<Applications />} />
          <Route path="/citizen/applications/new" element={<ApplicationNew />} />
          <Route path="/citizen/applications/:id" element={<ApplicationDetail />} />
          <Route path="/citizen/notifications" element={<Notifications />} />
          <Route path="/citizen/complaints" element={<Complaints />} />
          <Route path="/citizen/complaints/:id" element={<ComplaintDetail />} />
          <Route path="/citizen/profile" element={<Profile />} />
        </Route>

        {/* officer pages */}
        <Route element={<ProtectedRoute roles={['OFFICER']} />}>
          <Route path="/officer" element={<OfficerDashboard />} />
          <Route path="/officer/verify" element={<VerifyToken />} />
          <Route path="/officer/applications" element={<ApplicationsList role="OFFICER" />} />
          <Route path="/officer/applications/:id" element={<OfficerApplicationDetail />} />
          <Route path="/officer/complaints" element={<StaffComplaints base="/officer/complaints" />} />
          <Route path="/officer/complaints/:id" element={<StaffComplaintDetail base="/officer/complaints" />} />
        </Route>

        {/* admin pages */}
        <Route element={<ProtectedRoute roles={['ADMIN']} />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/offices" element={<ManageOffices />} />
          <Route path="/admin/services" element={<ManageServices />} />
          <Route path="/admin/officers" element={<ManageOfficers />} />
          <Route path="/admin/tokens" element={<AdminTokens />} />
          <Route path="/admin/applications" element={<ApplicationsList role="ADMIN" />} />
          <Route path="/admin/complaints" element={<StaffComplaints base="/admin/complaints" />} />
          <Route path="/admin/complaints/:id" element={<StaffComplaintDetail base="/admin/complaints" />} />
          <Route path="/admin/logs" element={<Logs />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
