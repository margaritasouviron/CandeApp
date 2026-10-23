import { type PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover"
        />
        <meta name="theme-color" content="#FFBACF" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root { height: 100%; width: 100%; margin: 0; }
              body {
                background: #FFFBF7;
                -webkit-text-size-adjust: 100%;
                overscroll-behavior: none;
              }
              input, textarea, select { font-size: 16px !important; }
              ::-webkit-scrollbar { width: 6px; }
              ::-webkit-scrollbar-thumb { background: #e0ccad; border-radius: 3px; }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
