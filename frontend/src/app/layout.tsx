import Navbar from "@/components/common/navbar";
import { AuthProvider } from "@/components/provider/auth-provider";
import { ModalProvider } from "@/components/provider/modal-provider";
import { QueryProviders } from "@/components/provider/query-provider";
import { ThemeProvider } from "@/components/provider/theme-provider";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// 모바일 상태 표시줄(시간/배터리 영역) 색상을 navbar 배경과 일치
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#123b5d" },
    { media: "(prefers-color-scheme: dark)", color: "#243a4c" },
  ],
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "MrEyes",
    template: "%s | MrEyes",
  },
  description: "MrEyes 서비스",
  applicationName: "MrEyes",
  robots: { index: false, follow: false },
  keywords: ["MrEyes", "Dashboard", "Monitoring"],
  metadataBase: new URL("https://app.pentaworks.net"),
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon/favicon.ico" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/favicon/apple-touch-icon.png", sizes: "180x180" }],
  },

  openGraph: {
    type: "website",
    siteName: "MrEyes",
    title: "MrEyes",
    description: "MrEyes 서비스",
    url: "/",
    images: [
      {
        url: "/favicon/android-chrome-512x512.png",
        width: 512,
        height: 512,
        alt: "MrEyes",
      },
    ],
  },

  twitter: {
    card: "summary",
    title: "MrEyes",
    description: "MrEyes 서비스",
    images: ["/favicon/android-chrome-512x512.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      data-scroll-behavior="smooth"
    >
      <body
        className={[
          geistSans.variable,
          geistMono.variable,
          "antialiased",
          // 추가: 라이트/다크 배경
          "bg-background-primary text-text-major",
          "dark:bg-background-dark-primary dark:text-text-dark-primary",
        ].join(" ")}
      >
        <QueryProviders>
          <ThemeProvider>
            <AuthProvider>
              <ModalProvider>
                <Navbar />
                {children}
              </ModalProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryProviders>
      </body>
    </html>
  );
}
