import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers"; 
import PreviewModeToggle from "@/components/PreviewModeToggle";

export const metadata: Metadata = {
  title: "Report Card Generator",
  description: "Easily create, customize, rank, and print student terminal reports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
        <meta name="theme-color" content="#64B5F6" />
        <link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="any" />
      </head>
      <body>
        <Providers>
          <div className="flex flex-col items-center gap-2 my-3">
            <PreviewModeToggle />
          </div>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
