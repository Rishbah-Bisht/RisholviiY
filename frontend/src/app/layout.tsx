import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://risholviiy.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "RisholviiY | Free PYQ Papers for Dehradun Colleges",
    template: "%s | RisholviiY"
  },
  description: "RisholviiY is a free Previous Year Question Paper (PYQ) platform for colleges in Dehradun, Uttarakhand. Designed & Developed by Rishabh Bisht. Download PYQs for BCA, MCA, BTech and more.",
  keywords: [
    "PYQ",
    "Previous Year Question Papers",
    "Dehradun PYQ",
    "Dehradun College Papers",
    "RisholviiY",
    "Rishabh Bisht",
    "PYQ Dehradun",
    "Uttarakhand College PYQ",
    "BCA PYQ Dehradun",
    "MCA PYQ Dehradun",
    "BTech PYQ Dehradun",
    "Semester Exam Papers",
    "Sessional Exam Papers",
    "Mid Semester Papers",
    "End Semester Papers",
    "Free Study Material Dehradun",
    "College Question Papers Uttarakhand"
  ],
  authors: [{ name: "Rishabh Bisht", url: SITE_URL }],
  creator: "Rishabh Bisht",
  publisher: "RisholviiY",
  category: "Education",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    title: "RisholviiY | Free PYQ Papers for Dehradun Colleges",
    description: "Download free Previous Year Question Papers (PYQs) for Dehradun colleges. BCA, MCA, BTech and more. Designed by Rishabh Bisht.",
    siteName: "RisholviiY",
  },
  twitter: {
    card: "summary_large_image",
    title: "RisholviiY | Free PYQ Papers for Dehradun Colleges",
    description: "Download free Previous Year Question Papers (PYQs) for Dehradun colleges. BCA, MCA, BTech and more.",
    creator: "@rishabh_bisht",
  },
  verification: {
    google: "YOUR_GOOGLE_SEARCH_CONSOLE_VERIFICATION_CODE",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "RisholviiY",
  "url": "https://risholviiy.com",
  "description": "Free Previous Year Question Paper (PYQ) platform for colleges in Dehradun, Uttarakhand.",
  "applicationCategory": "EducationalApplication",
  "operatingSystem": "Web",
  "author": {
    "@type": "Person",
    "name": "Rishabh Bisht",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Dehradun",
      "addressRegion": "Uttarakhand",
      "addressCountry": "IN"
    }
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "30.3165",
    "longitude": "78.0322"
  },
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "INR"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <Script
          id="json-ld-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          strategy="beforeInteractive"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
