import fetch from 'node-fetch';

async function diagnose() {
  try {
    const res = await fetch('https://maritim.bmkg.go.id/cuaca/pelabuhan/pelabuhan-ciwandan', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    const tableMatches = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)];
    if (tableMatches.length === 0) return;
    
    const tbodyMatches = [...tableMatches[0][1].matchAll(/<tbody[^>]*>([\s\S]*?)<\/tbody>/g)];
    if (tbodyMatches.length === 0) return;
    
    const rowMatches = [...tbodyMatches[0][1].matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/g)];
    
    // Let's print rows 8 and 15
    for (const idx of [8, 15]) {
      if (idx < rowMatches.length) {
        console.log(`\n================= Row ${idx} =================`);
        console.log(`Attributes:`, rowMatches[idx][1]);
        const cells = [...rowMatches[idx][2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
        cells.forEach((cell, cIdx) => {
          console.log(`  Cell ${cIdx}:`, cell[1].trim());
        });
      }
    }
  } catch (err) {
    console.error(err);
  }
}

diagnose();
