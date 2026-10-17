// Refresh the openly licensed IAU / Sky & Telescope charts. Node 18+, no packages.
const fs = require('node:fs');
const path = require('node:path');
const atlas = require('../atlas-iau.json');
const directory = path.join(__dirname, '..', 'assets', 'atlas');
const charts = Object.values(atlas.constellations).flatMap(item => item.charts);
const valid = buffer => buffer.length > 1000 && /^GIF8[79]a$/.test(buffer.subarray(0, 6).toString());

async function download(chart) {
  const file = path.join(directory, path.basename(new URL(chart.gifUrl).pathname));
  if (fs.existsSync(file) && valid(fs.readFileSync(file))) return;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(chart.gifUrl, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!valid(bytes)) throw new Error('Invalid GIF');
      fs.writeFileSync(file, bytes);
      return;
    } catch (error) {
      if (attempt === 2) throw new Error(`${chart.gifUrl}: ${error.message}`);
    }
  }
}

async function main() {
  fs.mkdirSync(directory, { recursive: true });
  for (let offset = 0; offset < charts.length; offset += 4) {
    await Promise.all(charts.slice(offset, offset + 4).map(download));
    console.log(`Charts: ${Math.min(offset + 4, charts.length)}/${charts.length}`);
  }
  const bytes = charts.reduce((sum, chart) => sum + fs.statSync(path.join(directory, path.basename(new URL(chart.gifUrl).pathname))).size, 0);
  console.log(`Verified ${charts.length} GIFs, ${(bytes / 1048576).toFixed(1)} MiB. Attribution: ${atlas.metadata.chartAttribution}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
