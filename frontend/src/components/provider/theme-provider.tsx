"use client";

import {
    type ReactNode,
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";

// 테마 타입 정의
type Theme = "light" | "dark" | "system";

// Context 타입 정의
interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

// Context 생성
const ThemeContext = createContext<ThemeContextType>({
  theme: "system",
  isDark: false,
  setTheme: () => {},
  toggleTheme: () => {},
});

// ThemeProvider 컴포넌트
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [isDark, setIsDarkState] = useState<boolean>(false);

  // 시스템 환경 기준 다크 여부 판단
  const detectSystemDark = () =>
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  // html.dark 클래스 토글
  const applyTheme = (t: "light" | "dark") => {
    document.documentElement.classList.toggle("dark", t === "dark");
  };

  // 초기 로드 및 시스템 테마 변경 감지
  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved === "light" || saved === "dark") {
      setThemeState(saved);
      setIsDarkState(saved === "dark");
      applyTheme(saved);
    } else {
      const systemDark = detectSystemDark();
      setIsDarkState(systemDark);
      applyTheme(systemDark ? "dark" : "light");
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => {
      // theme이 system일 때만 반영
      if (!localStorage.getItem("theme")) {
        setIsDarkState(e.matches);
        applyTheme(e.matches ? "dark" : "light");
      }
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  // 테마 변경 핸들러
  const setTheme = (t: Theme) => {
    setThemeState(t);
    if (t === "system") {
      localStorage.removeItem("theme");
      const systemDark = detectSystemDark();
      setIsDarkState(systemDark);
      applyTheme(systemDark ? "dark" : "light");
    } else {
      localStorage.setItem("theme", t);
      setIsDarkState(t === "dark");
      applyTheme(t);
    }
  };

  // 토글 함수
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// useTheme 훅
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
