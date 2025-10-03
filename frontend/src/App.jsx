import React from "react";
import { BrowserRouter as Router, Routes, Route, Outlet, useLocation, matchPath } from "react-router-dom";

import HomePage from "./components/HomePage";
import SignUpPage from "./components/SignUpPage";
import LoginPage from "./components/LoginPage";
import ServicesSection from "./components/ServicesSection";
import AboutPage from "./components/AboutPage";
import ContactPage from "./components/ContactPage";
import WorkerApplicationPage from "./components/WorkerApplicationPage";
import Navbar from "./components/Navbar";
import UserHomePage from "./components/UserHomePage";
import WorkerHomePage from "./components/WorkerHomePage";
import ProfileCompletionPage from "./components/ProfileCompletionPage";  // <-- Import this

function Layout() {
  const location = useLocation();

  // Routes where Navbar is hidden
  const hideNavbarPaths = [
    "/userhome",
    "/workerhome",
    "/reset-password/:uid/:token",
    "/add",
    "/complete-address"  // Make sure this matches your new route
  ];

  const showNavbar = !hideNavbarPaths.some(pattern =>
    matchPath({ path: pattern, end: true }, location.pathname)
  );

  return (
    <>
      {showNavbar && <Navbar />}
      <main className={showNavbar ? "pt-12" : ""}>
        <Outlet />
      </main>
    </>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/services" element={<ServicesSection />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/worker-application" element={<WorkerApplicationPage />} />
          <Route path="/workerhome" element={<WorkerHomePage />} />
          <Route path="/reset-password/:uid/:token" element={<LoginPage />} />
          <Route path="/userhome" element={<UserHomePage />} />

          {/* New Route for Profile Completion */}
          <Route path="/complete-address" element={<ProfileCompletionPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
