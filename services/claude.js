// services/claude.js
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function genererRapportIA({
  rapport,
  risques,
  geologie,
  parcelle,
  adresse,
  imageIgnBase64,
  imageBrgmBase64,
}) {
  const admin = rapport.bloc_administratif;
  const site = rapport.bloc_site_environnement;
  const synthese = rapport.bloc_synthese_preconisations;

  const prompt = `Tu es un ingénieur géotechnicien expert, rédacteur de rapports G1 ES conformes à la norme NF P 94-500.

Tu dois rédiger les sections textuelles d'un rapport géotechnique G1 ES à partir des données suivantes.
Ton style doit être professionnel, technique, précis, comme dans un vrai rapport de bureau d'études.
N'invente pas de données chiffrées précises, mais utilise les données fournies pour rédiger des textes cohérents.

## DONNÉES DU PROJET
- Adresse du site : ${site.adresse_terrain || adresse?.adresse || 'Non renseigné'}
- Commune : ${adresse?.commune || ''}
- Coordonnées GPS : Lat ${site.coordonnees_gps.latitude}, Lon ${site.coordonnees_gps.longitude}
- Description projet : ${admin.projet_description}
- Relief : ${site.topographie.relief}
- Pente : ${site.topographie.pente_pourcentage}%
- Altitude NGF : ${site.topographie.altitude_ngf}m
- Végétation : ${site.vegetation?.join(', ') || 'Non renseigné'}
- Historique : ${site.historique_site || 'Non renseigné'}

## DONNÉES GÉOLOGIQUES (BRGM)
${geologie ? `Formation : ${geologie.formation}\nDescription : ${geologie.description}\nAge : ${geologie.age}` : 'Données BRGM non disponibles — utilise les données générales de la région'}

## DONNÉES CADASTRALES
${parcelle ? `Section ${parcelle.section} n°${parcelle.numero} — Surface : ${parcelle.surface}` : 'Non disponible'}

## RISQUES NATURELS (GÉORISQUES)
- Argile : ${risques?.argile?.niveau} — ${risques?.argile?.detail}
- Séisme : ${risques?.seisme?.niveau} — ${risques?.seisme?.detail}
- Radon : ${risques?.radon?.niveau} — ${risques?.radon?.detail}
- Inondation : ${risques?.inondation?.niveau} — ${risques?.inondation?.detail}
- Cavités : ${risques?.cavite?.niveau} — ${risques?.cavite?.detail}

## PARAMÈTRES SISMIQUES SAISIS
- Catégorie d'importance : ${rapport.bloc_enquete_documentaire?.sismique?.categorie_importance || 'II'}
- Accélération ag : ${rapport.bloc_enquete_documentaire?.sismique?.acceleration_ag || 'À déterminer'}
- Paramètre S : ${rapport.bloc_enquete_documentaire?.sismique?.parametre_sol_S || 'À déterminer'}

## DONNÉES SAISIES PAR LE TECHNICIEN
- Géologie saisie : ${rapport.bloc_enquete_documentaire?.geologie_theorique || ''}
- Modèle lithologique saisi : ${synthese?.modele_lithologique_theorique || ''}
- ZIG saisie : ${synthese?.zig || ''}
- Investigations saisies : ${synthese?.programme_investigations_suggere?.join(', ') || ''}

Génère une réponse JSON avec exactement ces clés :

{
  "description_generale": "Texte 3-4 phrases décrivant le site, sa localisation, son contexte urbain/rural, la topographie",
  "geologie_theorique": "Texte 4-6 phrases décrivant la géologie du site d'après le BRGM : formation, nature des sols, substratum attendu",
  "contexte_hydrogeologique": "Texte 3-4 phrases sur les nappes potentielles, le contexte hydrogéologique local",
  "commentaires_risques": {
    "argile": "1-2 phrases de commentaire technique sur le risque argile",
    "seisme": "1-2 phrases avec les paramètres sismiques applicables (ag, S, catégorie importance)",
    "radon": "1 phrase",
    "inondation": "1-2 phrases",
    "cavite": "1 phrase"
  },
  "modele_lithologique": "Texte 4-5 phrases décrivant le modèle géologique attendu en profondeur, les couches probables",
  "zig": "Texte 2-3 phrases donnant une première approche de la ZIG avec une estimation chiffrée",
  "programme_investigations": ["investigation 1 détaillée", "investigation 2 détaillée", "investigation 3 détaillée"],
  "synthese_risques": "Texte 3-4 phrases de synthèse des contraintes géotechniques identifiées",
  "parametres_sismiques": {
    "zone": "zone de sismicité estimée",
    "ag": "valeur ag estimée si non saisie",
    "S": "paramètre S estimé si non saisi",
    "commentaire": "2-3 phrases techniques"
  }
}

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

  const messages = [{ role: 'user', content: prompt }];

  // Si on a des images, on les ajoute
  if (imageIgnBase64 || imageBrgmBase64) {
    const content = [];
    if (imageIgnBase64) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: imageIgnBase64.replace('data:image/png;base64,', '') },
      });
      content.push({ type: 'text', text: 'Voici la carte IGN du site.' });
    }
    if (imageBrgmBase64) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: imageBrgmBase64.replace('data:image/png;base64,', '') },
      });
      content.push({ type: 'text', text: 'Voici la carte géologique BRGM du site.' });
    }
    content.push({ type: 'text', text: prompt });
    messages[0].content = content;
  }

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4000,
    messages,
  });

  const text = response.content[0].text;
  // Nettoyer le JSON si nécessaire
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude n\'a pas retourné un JSON valide');
  return JSON.parse(jsonMatch[0]);
}

module.exports = { genererRapportIA };
