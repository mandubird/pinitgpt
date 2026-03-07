import "./globals.css";
import type { Metadata } from "next";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "GTM-NTBHXBK6";

export const metadata: Metadata = {
  title: "pinitgpt — Organize ChatGPT. Reuse Prompts.",
  description: "Pin and organize your best ChatGPT prompts and workflows so you never lose them again.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gtmHeadSnippet = GTM_ID
    ? "(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','" +
      GTM_ID +
      "');"
    : "";

  return (
    <html lang="en">
      <head>
        {GTM_ID ? <script dangerouslySetInnerHTML={{ __html: gtmHeadSnippet }} /> : null}
      </head>
      <body>
        {GTM_ID ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        ) : null}
        {children}
      </body>
    </html>
  );
}
