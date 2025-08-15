
import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Providers } from '@/components/providers'; 

const APP_NAME = 'Report Card Generator';
const APP_DESCRIPTION = 'Easily create, customize, rank, and print student terminal reports. An AI-powered tool for educators.';
const APP_URL = 'https://your-app-url.com'; 
const OG_IMAGE_URL = 'https://placehold.co/1200x630.png'; 

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`, 
  },
  description: APP_DESCRIPTION,
  keywords: ['report card', 'student reports', 'school', 'education', 'teacher tool', 'ai report generator', 'terminal report', 'gradebook'],
  manifest: '/manifest.json', 
  authors: [{ name: 'Firebase Studio App Prototyper' }], 
  creator: 'Firebase Studio App Prototyper', 
  publisher: 'Firebase Studio App Prototyper', 
  
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
      <body>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
