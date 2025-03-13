import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Server from "./components/Server";
import AdminLogin from "./components/AdminLogin";
import Battery_Server from "./components/Battery_server";
import Landing_page from "./components/Landing_page";
import SignUp from './components/SignUp';
import Chatbot from "./components/chatbot";

const App = () => {
  return (
    <div>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AdminLogin />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/chatbot" element={<Chatbot />} />
          <Route path="/bookings" element={<Server />} />
          <Route path="/battery" element={<Battery_Server />} />
          <Route path="/landpage" element={<Landing_page />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
};

export default App;
