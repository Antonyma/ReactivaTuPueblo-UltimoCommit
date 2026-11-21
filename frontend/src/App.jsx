import React from "react";
import { AppProvider } from "./context/AppContext.jsx";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import MobileNav from "./components/MobileNav.jsx";
import Toast from "./components/Toast.jsx";
import LoginModal from "./components/modals/LoginModal.jsx";
import TimeModal from "./components/modals/TimeModal.jsx";
import QuestionsModal from "./components/modals/QuestionsModal.jsx";
import ReviewsModal from "./components/modals/ReviewsModal.jsx";
import AttendeesModal from "./components/modals/AttendeesModal.jsx";
import "./App.css";

export default function App() {
  return (
    <AppProvider>
      <Navbar />
      <Home />
      <MobileNav />
      <Toast />

      {/* Modals */}
      <LoginModal />
      <TimeModal />
      <QuestionsModal />
      <ReviewsModal />
      <AttendeesModal />
    </AppProvider>
  );
}
