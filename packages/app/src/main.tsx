import React from "react";
import { createRoot } from "react-dom/client";
import { Root } from "./root";

createRoot(document.body).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
