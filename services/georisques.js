// services/georisques.js
const axios = require('axios');

const BASE = 'https://georisques.gouv.fr/api/v1';

async function getRisques(lat, lon) {
  const results = {};

  // Argile
  try {
    const r = await axios.get(`${BASE}/argiles`, { params: { latlon: `${lon},${lat}`, rayon: 100 }, timeout: 8000 });
    const zone = r.data?.zone;
    results.argile = {
      niveau: mapNiveauArgile(zone?.codeZone),
      source: 'Géorisques — Retrait-gonflement des argiles',
      detail: zone?.libelleZone || '',
    };
  } catch { results.argile = { niveau: 'Non déterminé', source: 'Géorisques', detail: '' }; }

  // Sismicité
  try {
    const r = await axios.get(`${BASE}/zonage_sismique`, { params: { latlon: `${lon},${lat}` }, timeout: 8000 });
    const zone = r.data?.zone;
    results.seisme = {
      niveau: mapNiveauSeisme(zone?.codeZone),
      source: 'Décret n°2010-1255 — Zonage sismique de la France',
      detail: zone ? `Zone de sismicité ${zone.codeZone} — ${zone.libelleZone}` : '',
      zone: zone?.codeZone,
    };
  } catch { results.seisme = { niveau: 'Non déterminé', source: 'Zonage sismique', detail: '' }; }

  // Radon
  try {
    const r = await axios.get(`${BASE}/radon`, { params: { latlon: `${lon},${lat}` }, timeout: 8000 });
    const cat = r.data?.categorie;
    results.radon = {
      niveau: mapNiveauRadon(cat),
      source: 'IRSN — Potentiel radon des formations géologiques',
      detail: cat ? `Catégorie ${cat}` : '',
    };
  } catch { results.radon = { niveau: 'Non déterminé', source: 'IRSN', detail: '' }; }

  // Inondation
  try {
    const r = await axios.get(`${BASE}/zone_inondable`, { params: { latlon: `${lon},${lat}`, rayon: 100 }, timeout: 8000 });
    const inzone = r.data?.inZone;
    results.inondation = {
      niveau: inzone ? 'Fort' : 'Nul',
      source: 'Géorisques — PPRI',
      detail: inzone
        ? 'Terrain situé en zone inondable selon le PPRI en vigueur'
        : "Terrain situé hors zone d'aléa inondation selon le PPRI",
    };
  } catch { results.inondation = { niveau: 'Non déterminé', source: 'PPRI', detail: '' }; }

  // Cavités
  try {
    const r = await axios.get(`${BASE}/cavites`, { params: { latlon: `${lon},${lat}`, rayon: 500 }, timeout: 8000 });
    const count = r.data?.total || 0;
    results.cavite = {
      niveau: count > 0 ? 'Moyen' : 'Nul',
      source: 'Géorisques — Base nationale des cavités souterraines',
      detail: count > 0
        ? `${count} cavité(s) recensée(s) dans un rayon de 500m`
        : 'Aucune cavité recensée à moins de 500m du projet',
    };
  } catch { results.cavite = { niveau: 'Non déterminé', source: 'Base nationale des cavités', detail: '' }; }

  return results;
}

function mapNiveauArgile(code) {
  const map = { '0': 'Nul', '1': 'Faible', '2': 'Moyen', '3': 'Fort', '4': 'Fort' };
  return map[String(code)] ?? 'Non déterminé';
}
function mapNiveauSeisme(code) {
  const map = { '1': 'Nul', '2': 'Faible', '3': 'Moyen', '4': 'Fort', '5': 'Très fort' };
  return map[String(code)] ?? 'Non déterminé';
}
function mapNiveauRadon(cat) {
  const map = { '1': 'Faible', '2': 'Moyen', '3': 'Fort' };
  return map[String(cat)] ?? 'Non déterminé';
}

module.exports = { getRisques };
