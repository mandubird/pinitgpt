import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export const metadata: Metadata = {
  title: "pinitgpt — Organize ChatGPT. Reuse Prompts.",
  description: "Pin and organize your best ChatGPT prompts and workflows so you never lose them again.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {GA_ID && (
          <Script id="ga4" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}', {
                page_path: window.location.pathname + window.location.search,
              });
            `}
          </Script>
        )}
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}

