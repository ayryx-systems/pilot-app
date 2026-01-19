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
  title: "AYRYX Pilot",
  description: "Aviation Situational Awareness for Pilots",
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "AYRYX Pilot",
    title: "AYRYX Pilot",
    description: "Aviation Situational Awareness for Pilots",
  },
  icons: {
    shortcut: "/ayryx_with_star_white.png",
    icon: "/ayryx_with_star_white.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/ayryx_with_star_white.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
