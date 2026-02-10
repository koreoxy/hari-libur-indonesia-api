// main.ts
// Backend RESTful API Kalender Libur Indonesia
// Tech: Hono.js (latest), TypeScript, Deno Deploy
// Data source: https://www.tanggalan.com/ (scraping realtime)

import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { cors } from "https://deno.land/x/hono@v4.3.11/middleware.ts";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

const app = new Hono();

app.use('*', cors());

// Utils

const kv = await Deno.openKv();

const CACHE_TTL = 60 * 60 * 24; // 24 jam

async function getCachedLibur(year: number) {
  const cached = await kv.get(["libur", year]);
  return cached.value as any[] | null;
}

async function setCachedLibur(year: number, data: any[]) {
  await kv.set(["libur", year], data, { expireIn: CACHE_TTL * 1000 });
}

async function scrapeLiburIndonesia(year: number) {
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

  const results: {
    date: string;
    title: string;
    type: "libur_nasional" | "cuti_bersama" | "hari_besar";
  }[] = [];

  const holidayElements = document.querySelectorAll(".holiday, .libur");

  holidayElements.forEach((el) => {
    const dateEl = el.querySelector(".date");
    const titleEl = el.querySelector(".title");

    if (!dateEl || !titleEl) return;

    const rawDate = dateEl.textContent?.trim() ?? "";
    const title = titleEl.textContent?.trim() ?? "";

    let type: "libur_nasional" | "cuti_bersama" | "hari_besar" = "hari_besar";

    if (/libur nasional/i.test(title)) type = "libur_nasional";
    if (/cuti bersama/i.test(title)) type = "cuti_bersama";

    results.push({ date: rawDate, title, type });
  });

  await setCachedLibur(year, results);
  return results;
}


(year: number) {
  const url = `https://www.tanggalan.com/${year}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error('Gagal mengambil data dari tanggalan.com');
  }

  const html = await res.text();
  const document = new DOMParser().parseFromString(html, 'text/html');

  if (!document) {
    throw new Error('Gagal parsing HTML');
  }

  const results: Array<{
    date: string;
    title: string;
    type: 'libur_nasional' | 'cuti_bersama' | 'hari_besar';
  }> = [];

  // Selector berdasarkan struktur umum tanggalan.com
  const holidayElements = document.querySelectorAll('.holiday, .libur');

  holidayElements.forEach((el) => {
    const dateEl = el.querySelector('.date');
    const titleEl = el.querySelector('.title');

    if (!dateEl || !titleEl) return;

    const rawDate = dateEl.textContent?.trim() ?? '';
    const title = titleEl.textContent?.trim() ?? '';

    let type: 'libur_nasional' | 'cuti_bersama' | 'hari_besar' = 'hari_besar';

    if (/libur nasional/i.test(title)) type = 'libur_nasional';
    if (/cuti bersama/i.test(title)) type = 'cuti_bersama';

    results.push({
      date: rawDate,
      title,
      type,
    });
  });

  return results;
}

// Routes

// Landing Page + API Docs
app.get('/docs', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Indonesia Holiday API Docs</title>
  <style>
    body { font-family: system-ui, sans-serif; background:#0f172a; color:#e5e7eb; margin:0 }
    header { padding:32px; background:#020617 }
    h1 { margin:0; font-size:28px }
    main { max-width:900px; margin:auto; padding:32px }
    code, pre { background:#020617; padding:12px; border-radius:8px; display:block; overflow-x:auto }
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
      <pre><code>${c.req.url.replace('/docs','')}</code></pre>
    </div>

    <div class="box">
      <h2>Endpoint</h2>
      <pre><code>GET /api/libur/{year}</code></pre>
    </div>

    <div class="box">
      <h2>Contoh Request</h2>
      <pre><code>curl ${c.req.url.replace('/docs','')}/api/libur/2025</code></pre>
    </div>

    <div class="box">
      <h2>Contoh Response</h2>
      <pre><code>{
  "year": 2025,
  "total": 16,
  "data": [
    {
      "date": "1 Januari",
      "title": "Tahun Baru Masehi",
      "type": "libur_nasional"
    }
  ]
}</code></pre>
    </div>

    <div class="box">
      <h2>Keterangan Field</h2>
      <ul>
        <li><b>date</b> : Tanggal libur</li>
        <li><b>title</b> : Nama hari libur</li>
        <li><b>type</b> : libur_nasional | cuti_bersama | hari_besar</li>
      </ul>
    </div>

    <div class="box">
      <h2>Sumber Data</h2>
      <p>Scraping realtime dari <a href="https://www.tanggalan.com" target="_blank">tanggalan.com</a></p>
    </div>

    <div class="box">
      <h2>Status</h2>
      <p>⚡ Fast • 🌐 Public • 🚀 Deno Deploy Ready</p>
    </div>
  </main>
</body>
</html>`);
});


app.get('/', (c) => {
  return c.json({
    name: 'Indonesia Holiday Calendar API',
    runtime: 'Deno Deploy',
    source: 'https://www.tanggalan.com/',
    endpoints: ['/api/libur/:year'],
  });
});

app.get('/api/libur/:year', async (c) => {
  const year = Number(c.req.param('year'));
  if (isNaN(year) || year < 1900) {
    return c.json({ error: 'Tahun tidak valid' }, 400);
  }

  const data = await scrapeLiburIndonesia(year);
  return c.json({ year, total: data.length, data });
});

// Filter by bulan
app.get('/api/libur/:year/bulan/:bulan', async (c) => {
  const year = Number(c.req.param('year'));
  const bulan = c.req.param('bulan').toLowerCase();

  const data = await scrapeLiburIndonesia(year);
  const filtered = data.filter(d => d.date.toLowerCase().includes(bulan));

  return c.json({ year, bulan, total: filtered.length, data: filtered });
});

// Filter by tanggal
app.get('/api/libur/:year/tanggal/:tanggal', async (c) => {
  const year = Number(c.req.param('year'));
  const tanggal = c.req.param('tanggal');

  const data = await scrapeLiburIndonesia(year);
  const filtered = data.filter(d => d.date.startsWith(tanggal));

  return c.json({ year, tanggal, total: filtered.length, data: filtered });
});
  } catch (err) {
    return c.json({
      error: 'Gagal mengambil data libur',
      message: err instanceof Error ? err.message : 'Unknown error',
    }, 500);
  }
});

// Deno Deploy export
export default app;
