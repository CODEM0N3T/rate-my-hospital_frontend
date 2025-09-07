import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import Header from "../Header/Header.jsx";
import Main from "../Main/Main.jsx";
import Footer from "../Footer/Footer.jsx";
import Home from "../../pages/Home.jsx";
import About from "../../pages/About.jsx";
import HospitalDetail from "../../pages/HospitalDetail.jsx";
import LoginModal from "../LoginModal/LoginModal.jsx";
import RegisterModal from "../RegisterModal/RegisterModal.jsx";
import {
  getCurrentUser,
  setCurrentUser,
  clearCurrentUser,
} from "../../storage/users.js";
import { upsertUser } from "../../storage/users.js";
import "./App.css";

export default function App() {
  const [user, setUser] = useState(() => getCurrentUser());
  const [isLoginOpen, setLoginOpen] = useState(false);
  const [isRegisterOpen, setRegisterOpen] = useState(false);

  function handleRegister(payload) {
    // Persist anon record locally (no PII). We keep recovery only to SHOW once.
    upsertUser(payload);
    setCurrentUser(payload);
    setUser(payload);
    setRegisterOpen(false);
  }

  function handleLogin(record) {
    setCurrentUser(record);
    setUser(record);
    setLoginOpen(false);
  }

  function handleSignOut() {
    clearCurrentUser();
    setUser(null);
  }

  return (
    <div className="layout">
      <Header
        loggedIn={Boolean(user)}
        onSignIn={() => setLoginOpen(true)}
        onSignUp={() => setRegisterOpen(true)}
        onSignOut={handleSignOut}
      />
      <Main>
        <Routes>
          <Route path="/" element={<Home currentUser={user} />} />
          <Route path="/about" element={<About />} />
          <Route
            path="/hospital/:providerId"
            element={<HospitalDetail currentUser={user} />}
          />
        </Routes>
      </Main>
      <Footer />

      {isLoginOpen && (
        <LoginModal
          onSubmit={handleLogin}
          onClose={() => setLoginOpen(false)}
        />
      )}
     {isRegisterOpen && (
  <RegisterModal
    onSubmit={handleRegister}
    onClose={() => setRegisterOpen(false)}
    onGoToLogin={() => {            // ← close Register, open Login
      setRegisterOpen(false);
      setLoginOpen(true);
    }}
  />
)}
    </div>
  );
}
