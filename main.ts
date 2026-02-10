// main.ts
// Backend RESTful API Kalender Libur Indonesia
// Tech: Hono.js, TypeScript, Deno Deploy
// Data source: https://www.tanggalan.com/ (scraping realtime)

import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { cors } from "https://deno.land/x/hono@v4.3.11/middleware.ts";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

type HolidayType = "libur_nasional" | "cuti_bersama" | "hari_besar";

interface Holiday {
  date: string;
  title: string;
  type: HolidayType;
}

const app = new Hono();
app.use("*", cors());

// ======================
// Deno KV (Cache)
// ======================
const kv = await Deno.openKv();
const CACHE_TTL = 60 * 60 * 24; // 24 jam

async function getCachedLibur(year: number): Promise<Holiday[] | null> {
  const cached = await kv.get<Holiday[]>(["libur", year]);
  return cached.value ?? null;
}

async function setCachedLibur(year: number, data: Holiday[]) {
  await kv.set(["libur", year], data, {
    expireIn: CACHE_TTL * 1000,
  });
}

// ======================
// Scraping Logic
// ======================
async function scrapeLiburIndonesia(year: number): Promise<Holiday[]> {
  const cached = await getCachedLibur(year);
  if (cached) return cached;

  const url = `https://www.tanggalan.com/${year}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("Gagal mengambil data dari tanggalan.com");
  }

  const html = await res.text();
  const document = new DOMParser().parseFromString(html, "text/html");

  if (!document) {
    throw new Error("Gagal parsing HTML");
  }

  const results: Holiday[] = [];

  const holidayElements = document.querySelectorAll(".holiday, .libur");

  holidayElements.forEach((el) => {
    const dateEl = el.querySelector(".date");
    const titleEl = el.querySelector(".title");

    if (!dateEl || !titleEl) return;

    const date = dateEl.textContent?.trim() ?? "";
    const title = titleEl.textContent?.trim() ?? "";

    let type: HolidayType = "hari_besar";

    if (/libur nasional/i.test(title)) type = "libur_nasional";
    if (/cuti bersama/i.test(title)) type = "cuti_bersama";

    results.push({ date, title, type });
  });

  await setCachedLibur(year, results);
  return results;
}

// ======================
// Routes
// ======================

// Landing Page + Docs
app.get("/docs", (c) => {
  const baseUrl = c.req.url.replace("/docs", "");

  return c.html(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Indonesia Holiday API</title>
  <style>
    body { font-family: system-ui; background:#0f172a; color:#e5e7eb; margin:0 }
    header { padding:32px; background:#020617 }
    main { max-width:900px; margin:auto; padding:32px }
    pre { background:#020617; padding:12px; border-radius:8px }
    .box { background:#020617; padding:20px; border-radius:12px; margin-bottom:24px }
    a { color:#38bdf8 }
  </style>
</head>
<body>
  <header>
    <h1>🇮🇩 Indonesia Holiday Calendar API</h1>
    <p>RESTful API libur nasional Indonesia (Realtime Scraping)</p>
  </header>
  <main>
    <div class="box">
      <h2>Base URL</h2>
      <pre>${baseUrl}</pre>
    </div>

    <div class="box">
      <h2>Endpoints</h2>
      <pre>
GET /api/libur/{year}
GET /api/libur/{year}/bulan/{bulan}
GET /api/libur/{year}/tanggal/{tanggal}
      </pre>
    </div>

    <div class="box">
      <h2>Contoh Request</h2>
      <pre>curl ${baseUrl}/api/libur/2025</pre>
    </div>

    <div class="box">
      <h2>Sumber Data</h2>
      <p><a href="https://www.tanggalan.com" target="_blank">tanggalan.com</a></p>
    </div>
  </main>
</body>
</html>`);
});

// Root
app.get("/", (c) =>
  c.json({
    name: "Indonesia Holiday Calendar API",
    runtime: "Deno Deploy",
    source: "https://www.tanggalan.com/",
    endpoints: [
      "/api/libur/:year",
      "/api/libur/:year/bulan/:bulan",
      "/api/libur/:year/tanggal/:tanggal",
    ],
  }),
);

// By year
app.get("/api/libur/:year", async (c) => {
  try {
    const year = Number(c.req.param("year"));
    if (isNaN(year) || year < 1900) {
      return c.json({ error: "Tahun tidak valid" }, 400);
    }

    const data = await scrapeLiburIndonesia(year);
    return c.json({ year, total: data.length, data });
  } catch (err) {
    return c.json(
      {
        error: "Gagal mengambil data libur",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      500,
    );
  }
});

// Filter by bulan
app.get("/api/libur/:year/bulan/:bulan", async (c) => {
  const year = Number(c.req.param("year"));
  const bulan = c.req.param("bulan").toLowerCase();

  const data = await scrapeLiburIndonesia(year);
  const filtered = data.filter((d) => d.date.toLowerCase().includes(bulan));

  return c.json({ year, bulan, total: filtered.length, data: filtered });
});

// Filter by tanggal
app.get("/api/libur/:year/tanggal/:tanggal", async (c) => {
  const year = Number(c.req.param("year"));
  const tanggal = c.req.param("tanggal");

  const data = await scrapeLiburIndonesia(year);
  const filtered = data.filter((d) => d.date.startsWith(tanggal));

  return c.json({ year, tanggal, total: filtered.length, data: filtered });
});

// ======================
// Export for Deno Deploy
// ======================
export default app;
