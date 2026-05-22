import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PEEC AI",
  description: "AI Visibility Tracker",
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

  return <ClerkProvider>{body}</ClerkProvider>;
}
