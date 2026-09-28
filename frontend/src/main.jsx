import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import L from "leaflet";

import App from "./App";
import "./index.css";

/* Leaflet.markercluster (1.5.3) registers itself on a GLOBAL `L`
   (`L.MarkerClusterGroup`) instead of importing Leaflet, so the app must
   expose the shared instance on window before any map chunk loads.
   Without this the fleet map crashes with
   "L.markerClusterGroup is not a function" and the page renders blank. */
if (!window.L) window.L = L;

ReactDOM.createRoot(document.getElementById("root")).render(
 <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);