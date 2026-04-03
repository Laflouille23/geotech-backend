// services/screenshots.js
const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function captureGeoportail(lat, lon) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    const url = `https://www.geoportail.gouv.fr/carte?c=${lon},${lat}&z=16&l0=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2::GEOPORTAIL:OGC:WMTS(1)&permalink=yes`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));
    const screenshotPath = path.join(os.tmpdir(), `ign_${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, type: 'png', clip: { x: 0, y: 0, width: 1200, height: 700 } });
    const base64 = fs.readFileSync(screenshotPath, { encoding: 'base64' });
    fs.unlinkSync(screenshotPath);
    return { data: base64, mediaType: 'image/png' };
  } catch (e) {
    console.log('[Screenshot IGN] Erreur:', e.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

async function getBRGMStaticImage(lat, lon) {
  try {
    const bbox = `${lat - 0.03},${lon - 0.03},${lat + 0.03},${lon + 0.03}`;
    const url = `https://mapsref.brgm.fr/wxs/1GG/BRGM_1M_GEOL_SIMPLIF?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=GEOLOGIE&STYLES=&CRS=EPSG:4326&BBOX=${bbox}&WIDTH=600&HEIGHT=600&FORMAT=image/png`;
    const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
    // Détecter le vrai type MIME depuis les headers
    const contentType = r.headers['content-type'] || 'image/png';
    const mediaType = contentType.split(';')[0].trim();
    const base64 = Buffer.from(r.data).toString('base64');
    return { data: base64, mediaType };
  } catch (e) {
    console.log('[BRGM Static] Erreur:', e.message);
    return null;
  }
}

module.exports = { captureGeoportail, getBRGMStaticImage };