import React from "react";
import type { PropsWithChildren } from "react";
import { ScrollViewStyleReset } from "expo-router/html";

// Web-only document shell. Native ignores this file.
//
// NOTE: with app.json's web.output set to "single" (SPA export), expo export does NOT render this
// template into the exported index.html — it only applies under web.output: "static". Verified by
// inspecting a real `expo export -p web` output. The app.json `web` block (name/description/
// themeColor) still lands in the default shell either way, which is why those meta tags are
// reliable but anything added only here (title, extra <link>/<style> tags) currently is not. If we
// switch to "static" output later, this file becomes fully effective as written.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Shishi — Shabbat dinners in Tel Aviv</title>
        <meta name="description" content="Warm Shabbat dinners in Tel Aviv — find a table, host, or sponsor." />
        <meta name="theme-color" content="#E11D48" />
        {/* Resets RN-web ScrollView so the document (not an inner view) scrolls. */}
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const globalStyles = `
html, body, #root { height: 100%; }
body { background-color: #FFF7F9; overflow-x: hidden; }
#root { display: flex; flex-direction: column; }
* { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
`;
