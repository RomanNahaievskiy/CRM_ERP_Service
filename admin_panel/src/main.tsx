import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/uk";
import "antd/dist/reset.css";
import "./index.css";
import App from "./App.tsx";
import AdminThemeProvider from "./theme/AdminThemeProvider.tsx";

dayjs.locale("uk");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AdminThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AdminThemeProvider>
  </StrictMode>,
);
