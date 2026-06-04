import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Thrive Vision",
  description: "AI Visibility Tracker",
  robots: { index: false, follow: false },
};

const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const isClerkConfigured =
  CLERK_KEY.startsWith("pk_") &&
  CLERK_KEY.length > 40 &&
  !CLERK_KEY.includes("dummy");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const body = (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-full flex flex-col`}>
        {children}
      </body>
    </html>
  );

  if (!isClerkConfigured) return body;

  return (
    <ClerkProvider afterSignOutUrl="/sign-in">
      {body}
    </ClerkProvider>
  );
}
