/**
 * Apaga uma requisicao de teste criada por `teste-slack.ts`, junto dos eventos
 * que a decisao tiver gerado.
 *
 *   npx tsx scripts/teste-slack-limpar.ts <requestId>
 *
 * Recusa apagar qualquer coisa que nao seja de teste (numero 9001), para nao
 * haver como levar um pedido de verdade junto.
 */
import { collections } from '../src/firebase';

const id = process.argv[2];
if (!id) {
  console.error('Informe o id da requisicao.');
  process.exit(1);
}

async function main(): Promise<void> {
  const ref = collections.requests().doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    console.log('nao existe (ja apagada?): ' + id);
    return;
  }

  const data = snap.data() ?? {};
  if (data.number !== 9001) {
    console.error('RECUSADO: numero ' + data.number + ' — isto nao e uma requisicao de teste.');
    process.exit(1);
  }

  const eventos = await collections.events(id).get();
  for (const doc of eventos.docs) await doc.ref.delete();
  await ref.delete();

  console.log('apagada: ' + id + ' (' + eventos.size + ' evento(s) junto)');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
