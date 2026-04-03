// services/cadastre.js
const axios = require('axios');

async function getParcelle(lat, lon) {
  try {
    // API Géoportail de l'urbanisme / Cadastre
    const r = await axios.get('https://geocodage.ign.fr/look4/parcel/reverse', {
      params: { lon, lat, limit: 1 },
      timeout: 8000,
    });
    const feature = r.data?.features?.[0];
    if (feature) {
      const props = feature.properties;
      return {
        numero: props.numero || '',
        section: props.section || '',
        commune: props.commune || '',
        surface: props.contenance ? `${props.contenance} m²` : '',
        departement: props.departement || '',
        codeInsee: props.codeinsee || '',
      };
    }
  } catch (e) {
    console.log('[Cadastre] Erreur:', e.message);
  }

  // Fallback : API cadastre.data.gouv.fr
  try {
    const r = await axios.get('https://cadastre.data.gouv.fr/api/ign/cadastre', {
      params: { lat, lon, type: 'parcel' },
      timeout: 8000,
    });
    const feature = r.data?.features?.[0];
    if (feature) {
      const props = feature.properties;
      return {
        numero: props.numero || '',
        section: props.section || '',
        commune: props.commune || '',
        surface: props.contenance ? `${props.contenance} m²` : 'Non disponible',
        departement: props.departement || '',
      };
    }
  } catch { }

  return null;
}

async function getAdresseFromCoords(lat, lon) {
  try {
    const r = await axios.get('https://api-adresse.data.gouv.fr/reverse/', {
      params: { lon, lat },
      timeout: 6000,
    });
    const feature = r.data?.features?.[0];
    if (feature) {
      return {
        adresse: feature.properties.label || '',
        commune: feature.properties.city || '',
        codePostal: feature.properties.postcode || '',
        departement: feature.properties.context || '',
      };
    }
  } catch { }
  return null;
}

module.exports = { getParcelle, getAdresseFromCoords };
