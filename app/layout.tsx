import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDFOasis – PDF Converter & Tools",
  description:
    "Convert, merge, and process PDF files with ease. Supports PDF to Word, PDF to image, merge PDFs, and more.",
  keywords: ["PDF converter", "PDF tools", "merge PDF", "PDF to Word", "PDF to image"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
