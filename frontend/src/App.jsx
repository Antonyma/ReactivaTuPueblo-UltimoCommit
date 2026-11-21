import React from "react";
import { AppProvider, useApp } from "./context/AppContext.jsx";
import Navbar from "./components/Navbar.jsx";
import OfflineStatusBar from "./components/OfflineStatusBar.jsx";
import Home from "./pages/Home.jsx";
import MobileNav from "./components/MobileNav.jsx";
import Toast from "./components/Toast.jsx";
import LoginModal from "./components/modals/LoginModal.jsx";
import TimeModal from "./components/modals/TimeModal.jsx";
import QuestionsModal from "./components/modals/QuestionsModal.jsx";
import ReviewsModal from "./components/modals/ReviewsModal.jsx";
import AttendeesModal from "./components/modals/AttendeesModal.jsx";
import "./App.css";

function AppShell() {
  const { rutaActual } = useApp();
  const enRutaAdmin = rutaActual === "/admin";

  return (
    <>
      <Navbar />
      <OfflineStatusBar />
      <Home />
      {!enRutaAdmin && <MobileNav />}
      <Toast />

      {/* Modals */}
      {!enRutaAdmin && <LoginModal />}
      <TimeModal />
      <QuestionsModal />
      <ReviewsModal />
      <AttendeesModal />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
