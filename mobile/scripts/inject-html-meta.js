#!/usr/bin/env node
// Post-processes dist/index.html after `expo export -p web`.
//
// app.json's web.output is "single" (SPA export), and under that mode Expo does NOT render
// app/+html.tsx into the exported document — only web.output: "static" does (verified against a
// real export; see the comment in app/+html.tsx). Switching output modes is a bigger change with its
// own tradeoffs (DinnerMap.web.tsx's Leaflet CSS injection reasons explicitly about "single" output),
// so this is the lower-blast-radius fix: rewrite the one shipped index.html directly, as a build step
// wired into vercel.json's buildCommand, rather than changing how Expo exports.
const fs = require("fs");
const path = require("path");

const DIST_INDEX = path.join(__dirname, "..", "dist", "index.html");

const TITLE = "Shishi — Shabbat dinners in Tel Aviv";
const DESCRIPTION = "Warm Shabbat dinners in Tel Aviv — find a table, host, or sponsor.";
// og-image.png is a placeholder (brand mark centered on a solid brand-color canvas, generated with
// sips, not real designed artwork) — swap for a real social preview image when one exists.
const OG_IMAGE = "/og-image.png";
const SITE_NAME = "Shishi";

function main() {
  if (!fs.existsSync(DIST_INDEX)) {
    console.error(`inject-html-meta: ${DIST_INDEX} not found — did \`expo export -p web\` run first?`);
    process.exit(1);
  }

  let html = fs.readFileSync(DIST_INDEX, "utf8");

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${TITLE}</title>`);

  const extraTags = `
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:title" content="${TITLE}">
  <meta property="og:description" content="${DESCRIPTION}">
  <meta property="og:image" content="${OG_IMAGE}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${TITLE}">
  <meta name="twitter:description" content="${DESCRIPTION}">
  <meta name="twitter:image" content="${OG_IMAGE}">
  <link rel="manifest" href="/manifest.json">
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
</head>`;

  if (!html.includes('property="og:title"')) {
    html = html.replace("</head>", extraTags);
  }

  fs.writeFileSync(DIST_INDEX, html);
  console.log(`inject-html-meta: updated ${path.relative(process.cwd(), DIST_INDEX)}`);
}

main();
