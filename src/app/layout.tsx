
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from '@/components/theme-provider';

const APP_NAME = 'Report Card Generator';
const APP_DESCRIPTION = 'Easily create, customize, rank, and print student terminal reports. An AI-powered tool for educators.';
const APP_URL = 'https://your-app-url.com'; // Replace with your actual app URL once deployed
const OG_IMAGE_URL = 'https://placehold.co/1200x630.png'; // Replace with your actual OG image URL

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`, // For specific pages that might set their own title
  },
  description: APP_DESCRIPTION,
  keywords: ['report card', 'student reports', 'school', 'education', 'teacher tool', 'ai report generator', 'terminal report', 'gradebook'],
  manifest: '/manifest.json', // Assuming you might add a PWA manifest later
  authors: [{ name: 'Firebase Studio App Prototyper' }], // You can change this
  creator: 'Firebase Studio App Prototyper', // You can change this
  publisher: 'Firebase Studio App Prototyper', // You can change this
  
  // Open Graph Metadata
  openGraph: {
    type: 'website',
    url: APP_URL,
    title: APP_NAME,
    description: APP_DESCRIPTION,
    siteName: APP_NAME,
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: `${APP_NAME} - Main Visual`,
      },
    ],
  },

  // Twitter Card Metadata
  twitter: {
    card: 'summary_large_image',
    title: APP_NAME,
    description: APP_DESCRIPTION,
    // creator: '@yourTwitterHandle', // Optional: replace with your Twitter handle
    images: [OG_IMAGE_URL],
  },

  // Viewport settings (Next.js handles this by default, but explicitly stating can be good)
  viewport: 'minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, viewport-fit=cover',

  // Robots (Control search engine crawling)
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // Apple-specific tags (if needed for PWA-like behavior on iOS)
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: 'default', 
  },
  
  // Icons (Next.js default, but can be customized)
  // icons: {
  //   icon: '/favicon.ico',
  //   shortcut: '/favicon-16x16.png',
  //   apple: '/apple-touch-icon.png',
  // },

  // Theme color (for browser UI)
  // themeColor: '#ffffff', // Set your primary theme color
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* The <link> tags for fonts are kept here as they are specific font loading strategies */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        {/* If you add a manifest.json, you would link it here too, though Next.js can handle it via metadata object */}
        {/* <link rel="manifest" href="/manifest.json" /> */}
        {/* Placeholder for data-ai-hint for the OG image if needed, though it's used in metadata directly */}
        {/* <meta data-ai-hint="education report" /> */}
      </head>
      <body className="font-body antialiased">
        <ThemeProvider
          defaultTheme="light"
          storageKey="report-card-theme"
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
