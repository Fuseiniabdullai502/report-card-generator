
import type {Metadata, Viewport} from 'next';
import { Inter } from 'next/font/google'; // Import the font
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Providers } from '@/components/providers'; // Import the new Providers component

// Initialize the font with desired weights and subsets
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

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

  twitter: {
    card: 'summary_large_image',
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: [OG_IMAGE_URL],
  },

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

  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: 'default', 
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* The <head> tag can be removed as next/font handles it */}
      <body className={`${inter.variable} font-body antialiased`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
