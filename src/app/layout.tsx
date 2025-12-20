import Navbar from "@/components/common/navbar";
import { ModalProvider } from "@/components/provider/modal-provider";
import { QueryProviders } from "@/components/provider/query-provider";
import { ThemeProvider } from "@/components/provider/theme-provider";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
    default: "PENTA WORKS",
    template: "%s | PENTA WORKS",
  },
  description: "PENTA WORKS 서비스",
  applicationName: "PENTA WORKS",
  keywords: ["PENTA WORKS", "Dashboard", "Monitoring"],
  metadataBase: new URL("https://your-domain.com"), // TODO 도메인 나오면 변경 필요
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
    siteName: "PENTA WORKS",
    title: "PENTA WORKS",
    description: "PENTA WORKS 서비스",
    url: "/",
    images: [
      {
        url: "/favicon/android-chrome-512x512.png",
        width: 512,
        height: 512,
        alt: "PENTA WORKS",
      },
    ],
  },

  twitter: {
    card: "summary",
    title: "PENTA WORKS",
    description: "PENTA WORKS 서비스",
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
      lang="en"
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
            <ModalProvider>
              <Navbar />
              {children}
            </ModalProvider>
          </ThemeProvider>
        </QueryProviders>
      </body>
    </html>
  );
}
