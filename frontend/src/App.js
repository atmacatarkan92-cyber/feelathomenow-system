import React from "react";
import "@/App.css";
import { BrowserRouter } from "react-router-dom";
import { LanguageProvider } from "./contexts/LanguageContext";
import AppRouter from "./routes/AppRouter";

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;
