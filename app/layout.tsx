import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Visual Ideation Studio",
  description: "A Spectrum-inspired AI reference generator for image-led creative exploration."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
