import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ConfigProvider, theme as antdTheme } from "antd";
import ukUA from "antd/locale/uk_UA";
import { AdminThemeContext, type ThemeMode } from "./adminThemeContext";

const THEME_STORAGE_KEY = "klr-admin-theme";
const DARK_HOUR_START = 20;
const DARK_HOUR_END = 7;

function getStoredMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "system";
  }

  const storedMode = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (
    storedMode === "light" ||
    storedMode === "dark" ||
    storedMode === "system" ||
    storedMode === "time"
  ) {
    return storedMode;
  }

  return "system";
}

function isNightTime() {
  const hour = new Date().getHours();

  return hour >= DARK_HOUR_START || hour < DARK_HOUR_END;
}

function getSystemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveIsDark(mode: ThemeMode) {
  if (typeof window === "undefined") {
    return false;
  }

  if (mode === "dark") {
    return true;
  }

  if (mode === "light") {
    return false;
  }

  if (mode === "time") {
    return isNightTime();
  }

  return getSystemPrefersDark();
}

type AdminThemeProviderProps = {
  children: ReactNode;
};

function AdminThemeProvider({ children }: AdminThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(getStoredMode);
  const [isDark, setIsDark] = useState(() => resolveIsDark(getStoredMode()));

  const setMode = (nextMode: ThemeMode) => {
    setModeState(nextMode);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
    setIsDark(resolveIsDark(nextMode));
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => setIsDark(resolveIsDark(mode));

    updateTheme();

    mediaQuery.addEventListener("change", updateTheme);
    const intervalId = window.setInterval(updateTheme, 60_000);

    return () => {
      mediaQuery.removeEventListener("change", updateTheme);
      window.clearInterval(intervalId);
    };
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;

    root.dataset.theme = isDark ? "dark" : "light";
    root.style.colorScheme = isDark ? "dark" : "light";
  }, [isDark]);

  const themeConfig = useMemo(
    () => ({
      algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: "#E30613",
        borderRadius: 6,
        fontFamily:
          'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      },
      components: {
        Button: {
          borderRadius: 4,
        },
        Card: {
          borderRadiusLG: 6,
        },
        Layout: {
          bodyBg: isDark ? "#0f172a" : "#f5f7fb",
          headerBg: isDark ? "#111827" : "#ffffff",
          siderBg: isDark ? "#111827" : "#ffffff",
        },
        Table: {
          headerBg: isDark ? "#1f2937" : "#E30613",
          headerColor: "#ffffff",
          headerSortActiveBg: "#b6050f",
          headerSortHoverBg: "#b6050f",
        },
      },
    }),
    [isDark],
  );

  const value = useMemo(
    () => ({
      isDark,
      mode,
      setMode,
    }),
    [isDark, mode],
  );

  return (
    <AdminThemeContext.Provider value={value}>
      <ConfigProvider locale={ukUA} theme={themeConfig}>
        {children}
      </ConfigProvider>
    </AdminThemeContext.Provider>
  );
}

export default AdminThemeProvider;
