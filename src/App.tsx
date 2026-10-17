import { Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import Search from "./pages/Search";
import Plans from "./pages/Plans";
import Signup from "./pages/Signup";
import Checkout from "./pages/Checkout";
import Login from "./pages/Login";
import StoryViewer from "./pages/StoryViewer";
import Legal from "./pages/legal/Legal";
import Welcome from "./pages/Welcome";
import Dashboard from "./pages/Dashboard";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/search" element={<Search />} />
      <Route path="/plans" element={<Plans />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/story-viewer" element={<StoryViewer />} />
      <Route path="/app" element={<Dashboard />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/terms" element={<Legal page="terms" />} />
      <Route path="/privacy" element={<Legal page="privacy" />} />
      <Route path="/refund-policy" element={<Legal page="refund" />} />
      <Route path="/contact" element={<Legal page="contact" />} />
    </Routes>
  );
}
