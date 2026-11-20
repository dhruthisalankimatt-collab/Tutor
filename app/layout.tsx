import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smruthi's Tutor - Personalized AI Learning Platform",
  description: "AI-Powered Socratic Learning Platform for Smruthi and Dhruthi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
