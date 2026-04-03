require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getRisques } = require('./services/georisques');
const { getGeologie } = require('./services/brgm');
const { getParcelle, getAdresseFromCoords } = require('./services/cadastre');
const { captureGeoportail, getBRGMStaticImage } = require('./services/screenshots');
const { genererRapportIA } = require('./services/claude');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => res.json({ status: 'ok', service: 'GEOTECH Backend' }));

app.post('/generate', async (req, res) => {
  const { rapport } = req.body;
  if (!rapport) return res.status(400).json({ error: 'Rapport manquant' });

  const lat = rapport.bloc_site_environnement?.coordonnees_gps?.latitude;
  const lon = rapport.bloc_site_environnement?.coordonnees_gps?.longitude;

  if (!lat || !lon || lat === 0 || lon === 0) {
    return res.status(400).json({ error: 'Coordonnées GPS manquantes' });
  }

  console.log(`[Generate] Démarrage pour ${lat}, ${lon}`);

  try {
    // Étape 1 : données en parallèle
    console.log('[Generate] Collecte des données...');
    const [risques, geologie, parcelle, adresse] = await Promise.allSettled([
      getRisques(lat, lon),
      getGeologie(lat, lon),
      getParcelle(lat, lon),
      getAdresseFromCoords(lat, lon),
    ]);

    const risquesData  = risques.status === 'fulfilled' ? risques.value : {};
    const geologieData = geologie.status === 'fulfilled' ? geologie.value : null;
    const parcelleData = parcelle.status === 'fulfilled' ? parcelle.value : null;
    const adresseData  = adresse.status === 'fulfilled' ? adresse.value : null;

    // Étape 2 : cartes
    console.log('[Generate] Capture des cartes...');
    const [ignResult, brgmResult] = await Promise.allSettled([
      captureGeoportail(lat, lon),
      getBRGMStaticImage(lat, lon),
    ]);

    const imageIgn  = ignResult.status === 'fulfilled' ? ignResult.value : null;
    const imageBrgm = brgmResult.status === 'fulfilled' ? brgmResult.value : null;

    console.log('[Generate] Cartes :', { ign: !!imageIgn, brgm: !!imageBrgm });

    // Étape 3 : Claude
    console.log('[Generate] Rédaction Claude...');
    const iaResult = await genererRapportIA({
      rapport, risques: risquesData, geologie: geologieData,
      parcelle: parcelleData, adresse: adresseData,
      imageIgn, imageBrgm,
    });

    console.log('[Generate] ✅ Terminé');

    res.json({
      success: true,
      data: {
        ia: iaResult,
        risques: risquesData,
        geologie: geologieData,
        parcelle: parcelleData,
        adresse: adresseData,
        images: {
          ign: imageIgn ? `data:${imageIgn.mediaType};base64,${imageIgn.data}` : null,
          brgm: imageBrgm ? `data:${imageBrgm.mediaType};base64,${imageBrgm.data}` : null,
        },
      },
    });

  } catch (error) {
    console.error('[Generate] Erreur:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 GEOTECH Backend sur le port ${PORT}`));