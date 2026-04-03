// services/claude.js
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function genererRapportIA({ rapport, risques, geologie, parcelle, adresse, imageIgn, imageBrgm }) {
  const admin = rapport.bloc_administratif;
  const site = rapport.bloc_site_environnement;
  const synthese = rapport.bloc_synthese_preconisations;

  const prompt = `Tu es un ingénieur géotechnicien expert, rédacteur de rapports G1 ES conformes à la norme NF P 94-500.

Rédige les sections textuelles d'un rapport géotechnique G1 ES à partir des données suivantes.
Style professionnel, technique, précis, comme dans un vrai rapport de bureau d'études.

## DONNÉES DU PROJET
- Adresse : ${site.adresse_terrain || adresse?.adresse || 'Non renseigné'}
- Commune : ${adresse?.commune || ''}
- GPS : Lat ${site.coordonnees_gps.latitude}, Lon ${site.coordonnees_gps.longitude}
- Projet : ${admin.projet_description}
- Relief : ${site.topographie.relief}, Pente : ${site.topographie.pente_pourcentage}%, Altitude NGF : ${site.topographie.altitude_ngf}m
- Végétation : ${site.vegetation?.join(', ') || 'Non renseigné'}
- Historique : ${site.historique_site || 'Non renseigné'}

## GÉOLOGIE (BRGM)
${geologie ? `Formation : ${geologie.formation}\nDescription : ${geologie.description}` : 'Non disponible'}

## CADASTRE
${parcelle ? `Section ${parcelle.section} n°${parcelle.numero} — Surface : ${parcelle.surface}` : 'Non disponible'}

## RISQUES (GÉORISQUES)
- Argile : ${risques?.argile?.niveau} — ${risques?.argile?.detail}
- Séisme : ${risques?.seisme?.niveau} — ${risques?.seisme?.detail}
- Radon : ${risques?.radon?.niveau} — ${risques?.radon?.detail}
- Inondation : ${risques?.inondation?.niveau} — ${risques?.inondation?.detail}
- Cavités : ${risques?.cavite?.niveau} — ${risques?.cavite?.detail}

Génère UNIQUEMENT ce JSON :
{
  "description_generale": "3-4 phrases décrivant le site",
  "geologie_theorique": "4-6 phrases sur la géologie BRGM",
  "contexte_hydrogeologique": "3-4 phrases sur les nappes",
  "commentaires_risques": {
    "argile": "1-2 phrases",
    "seisme": "1-2 phrases avec paramètres sismiques",
    "radon": "1 phrase",
    "inondation": "1-2 phrases",
    "cavite": "1 phrase"
  },
  "modele_lithologique": "4-5 phrases sur le modèle géologique attendu",
  "zig": "2-3 phrases avec estimation chiffrée de la ZIG",
  "programme_investigations": ["investigation 1", "investigation 2", "investigation 3"],
  "parametres_sismiques": {
    "ag": "valeur estimée",
    "S": "valeur estimée",
    "commentaire": "2-3 phrases"
  }
}`;

  const content = [];

  // Ajout des images si disponibles
  if (imageIgn?.data) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: imageIgn.mediaType, data: imageIgn.data },
    });
    content.push({ type: 'text', text: 'Carte IGN du site.' });
  }
  if (imageBrgm?.data) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: imageBrgm.mediaType, data: imageBrgm.data },
    });
    content.push({ type: 'text', text: 'Carte géologique BRGM du site.' });
  }
  content.push({ type: 'text', text: prompt });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    messages: [{ role: 'user', content }],
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude n\'a pas retourné un JSON valide');
  return JSON.parse(jsonMatch[0]);
}

module.exports = { genererRapportIA };