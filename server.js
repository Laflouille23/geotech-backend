// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getRisques } = require('./services/georisques');
const { getGeologie, getCarteGeologiqueUrl } = require('./services/brgm');
const { getParcelle, getAdresseFromCoords } = require('./services/cadastre');
const { captureGeoportail, getBRGMStaticImage } = require('./services/screenshots');
const { genererRapportIA } = require('./services/claude');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── Health check ──────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok', service: 'GEOTECH Backend' }));

// ── Route principale : génération IA complète ────────────────────────────
app.post('/generate', async (req, res) => {
  const { rapport } = req.body;

  if (!rapport) return res.status(400).json({ error: 'Rapport manquant' });

  const lat = rapport.bloc_site_environnement?.coordonnees_gps?.latitude;
  const lon = rapport.bloc_site_environnement?.coordonnees_gps?.longitude;

  if (!lat || !lon || lat === 0 || lon === 0) {
    return res.status(400).json({ error: 'Coordonnées GPS manquantes ou nulles' });
  }

  console.log(`[Generate] Démarrage pour ${lat}, ${lon}`);

  try {
    // ── Étape 1 : Données parallèles (rapide) ──
    console.log('[Generate] Étape 1 : Collecte des données...');
    const [risques, geologie, parcelle, adresse] = await Promise.allSettled([
      getRisques(lat, lon),
      getGeologie(lat, lon),
      getParcelle(lat, lon),
      getAdresseFromCoords(lat, lon),
    ]);

    const risquesData   = risques.status === 'fulfilled' ? risques.value : {};
    const geologieData  = geologie.status === 'fulfilled' ? geologie.value : null;
    const parcelleData  = parcelle.status === 'fulfilled' ? parcelle.value : null;
    const adresseData   = adresse.status === 'fulfilled' ? adresse.value : null;

    console.log('[Generate] Données collectées :', {
      risques: !!risquesData,
      geologie: !!geologieData,
      parcelle: !!parcelleData,
    });

    // ── Étape 2 : Screenshots cartes ──
    console.log('[Generate] Étape 2 : Capture des cartes...');
    const [ignImg, brgmImg] = await Promise.allSettled([
      captureGeoportail(lat, lon),
      getBRGMStaticImage(lat, lon),
    ]);

    const imageIgn  = ignImg.status === 'fulfilled' ? ignImg.value : null;
    const imageBrgm = brgmImg.status === 'fulfilled' ? brgmImg.value : null;

    console.log('[Generate] Cartes :', { ign: !!imageIgn, brgm: !!imageBrgm });

    // ── Étape 3 : Rédaction IA ──
    console.log('[Generate] Étape 3 : Rédaction Claude...');
    const iaResult = await genererRapportIA({
      rapport,
      risques: risquesData,
      geologie: geologieData,
      parcelle: parcelleData,
      adresse: adresseData,
      imageIgnBase64: imageIgn,
      imageBrgmBase64: imageBrgm,
    });

    console.log('[Generate] ✅ Terminé');

    // ── Réponse ──
    res.json({
      success: true,
      data: {
        ia: iaResult,
        risques: risquesData,
        geologie: geologieData,
        parcelle: parcelleData,
        adresse: adresseData,
        images: {
          ign: imageIgn,
          brgm: imageBrgm,
        },
      },
    });

  } catch (error) {
    console.error('[Generate] Erreur:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── Route rapide : risques seulement (sans IA) ───────────────────────────
app.post('/risques', async (req, res) => {
  const { lat, lon } = req.body;
  if (!lat || !lon) return res.status(400).json({ error: 'lat/lon manquants' });
  try {
    const risques = await getRisques(lat, lon);
    res.json({ success: true, risques });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 GEOTECH Backend démarré sur le port ${PORT}`));
