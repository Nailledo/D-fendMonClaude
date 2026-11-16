/**
 * Exemple officiel : génération d'une vidéo Seedance 2.5 via le SDK Higgsfield.
 *   pnpm hf:example
 * Les identifiants viennent de HF_CREDENTIALS (fichier .env.local, ignoré par git,
 * chargé par `node --env-file`). Leur valeur n'est jamais affichée.
 * Chaque exécution réussie est facturée.
 */
import { config, higgsfield } from '@higgsfield/client/v2';

const credentials = process.env.HF_CREDENTIALS;
if (!credentials || !credentials.includes(':')) {
  console.error('HF_CREDENTIALS manquant : ajoutez HF_CREDENTIALS=key-id:key-secret dans .env.local');
  process.exit(2);
}
config({ credentials });

const ENDPOINT = 'bytedance/seedance-2.5/text-to-video';

async function main() {
  console.log(`Envoi à ${ENDPOINT}…`);
  const result = await higgsfield.subscribe(ENDPOINT, {
    input: { prompt: 'A cinematic scene at sunset', duration: 5, resolution: '720p', aspect_ratio: '16:9' },
    withPolling: true,
  });
  switch (result.status) {
    case 'completed': {
      const url = result.video?.url;
      if (!url) {
        console.error(`Requête ${result.request_id} terminée mais sans URL de vidéo.`);
        process.exit(1);
      }
      console.log(`Vidéo générée : ${url}`);
      return;
    }
    case 'nsfw':
      console.error(`Requête ${result.request_id} rejetée par la modération.`);
      process.exit(1);
    // eslint-disable-next-line no-fallthrough
    case 'failed':
      console.error(`Requête ${result.request_id} en échec.`);
      process.exit(1);
    // eslint-disable-next-line no-fallthrough
    default:
      console.error(`Requête ${result.request_id} non terminée (statut : ${result.status}).`);
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  const e = err as { name?: string; message?: string; status?: number };
  console.error(`Échec : ${e?.name ?? 'Error'}${e?.status ? ` (HTTP ${e.status})` : ''} — ${e?.message ?? String(err)}`);
  process.exit(1);
});
