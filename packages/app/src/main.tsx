import React from "react";
import { createRoot } from "react-dom/client";
import { Root } from "./pages/root";

createRoot(document.body).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
