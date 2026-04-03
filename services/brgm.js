// services/brgm.js
const axios = require('axios');

async function getGeologie(lat, lon) {
  try {
    // API WMS BRGM pour la carte géologique
    const url = 'https://geoservices.brgm.fr/geologie';
    const params = {
      SERVICE: 'WMS',
      VERSION: '1.3.0',
      REQUEST: 'GetFeatureInfo',
      LAYERS: 'GEOLOGIE',
      QUERY_LAYERS: 'GEOLOGIE',
      CRS: 'EPSG:4326',
      BBOX: `${lat - 0.01},${lon - 0.01},${lat + 0.01},${lon + 0.01}`,
      WIDTH: 101,
      HEIGHT: 101,
      I: 50,
      J: 50,
      INFO_FORMAT: 'application/json',
    };
    const r = await axios.get(url, { params, timeout: 10000 });
    const features = r.data?.features;
    if (features && features.length > 0) {
      const props = features[0].properties;
      return {
        formation: props?.NOTATION || props?.DESCR || '',
        description: props?.DESCR || '',
        age: props?.AGE || '',
        legende: props?.LEGENDE || '',
      };
    }
  } catch (e) {
    console.log('[BRGM] Erreur WMS:', e.message);
  }

  // Fallback : InfoTerre API
  try {
    const r = await axios.get('https://infoterre.brgm.fr/api/1/geo/geol', {
      params: { lat, lon },
      timeout: 8000,
    });
    return { formation: r.data?.formation || '', description: r.data?.description || '' };
  } catch {
    return null;
  }
}

// Capture screenshot carte BRGM géologique
async function getCarteGeologiqueUrl(lat, lon) {
  const bbox = `${lat - 0.05},${lon - 0.05},${lat + 0.05},${lon + 0.05}`;
  return `https://mapsref.brgm.fr/wxs/1GG/BRGM_1M_GEOL_SIMPLIF?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=GEOLOGIE&STYLES=&CRS=EPSG:4326&BBOX=${bbox}&WIDTH=600&HEIGHT=600&FORMAT=image/png`;
}

module.exports = { getGeologie, getCarteGeologiqueUrl };
