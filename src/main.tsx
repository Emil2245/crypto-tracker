import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import "./index.css";
import App from "./App.tsx";
import { seedPortfolio } from "@/db/seed";

async function bootstrap() {
  if (new URLSearchParams(window.location.search).has("seed")) {
    await seedPortfolio();
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <App />
      </ThemeProvider>
    </StrictMode>
  );
}

bootstrap();
