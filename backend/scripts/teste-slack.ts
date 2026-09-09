/**
 * Teste do bot: cria UMA requisicao de teste e manda o card para um Slack ID
 * escolhido, sem passar pelo envio automatico.
 *
 *   npx tsx scripts/teste-slack.ts <slackId>
 *
 * `notify.adminPending: false` e o que impede o watcher de avisar a
 * administradora — o card vai so para quem for informado aqui.
 */
import { collections, serverTimestamp } from '../src/firebase';
import { adminRequestBlocks, fallbackText } from '../src/slack/blocks';
import { postDm } from '../src/slack/client';
import { toRequest } from '../src/lib/repo';

const destino = process.argv[2];
if (!destino) {
  console.error('Informe o Slack ID de destino.');
  process.exit(1);
}

async function main(): Promise<void> {
  const itens = await collections.items().limit(1).get();
  if (itens.empty) throw new Error('nenhum item cadastrado');
  const item = itens.docs[0];

  const cfg = await collections.settingsApp().get();
  const cidade = (cfg.data()?.cities ?? [])[0] ?? { name: 'Maceió', state: 'AL', lat: -9.6658, lng: -35.7353 };

  const ref = collections.requests().doc();
  await ref.set({
    number: 9001,
    requesterId: destino,
    requesterName: 'TESTE — Carlos Eduardo',
    items: [{ itemId: item.id, name: item.data().name, quantity: 1 }],
    purposeType: 'Teste',
    purpose: 'Requisição de teste do bot do Slack. Pode aprovar ou reprovar à vontade — será apagada em seguida.',
    city: cidade,
    startDate: '2027-06-01',
    endDate: '2027-06-02',
    days: 2,
    status: 'pending',
    slack: {},
    // A flag que dispara o aviso automatico fica DESLIGADA de proposito.
    notify: { adminPending: false },
    unread: { admin: 0, requester: 0 },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const snap = await ref.get();
  const request = toRequest(snap);
  if (!request) throw new Error('nao consegui reler a requisicao');

  const posted = await postDm(
    destino,
    fallbackText(request, '🟡 Nova requisição'),
    adminRequestBlocks({ request, blocking: [], warnings: [] })
  );

  if (!posted) throw new Error('o Slack recusou a mensagem');

  // Guarda o endereco da mensagem: e assim que o backend edita o card depois
  // da decisao (refreshAdminCard).
  await ref.update({
    'slack.adminChannel': posted.channel,
    'slack.adminMessageTs': posted.ts,
    updatedAt: serverTimestamp(),
  });

  console.log('requisicao de teste: ' + ref.id);
  console.log('card enviado para..: ' + destino + ' (canal ' + posted.channel + ', ts ' + posted.ts + ')');
  console.log('item...............: ' + item.data().name);
  console.log('periodo............: 2027-06-01 a 2027-06-02 (futuro distante, nao afeta a agenda de ninguem)');
  console.log('');
  console.log('Para apagar depois: npx tsx scripts/teste-slack-limpar.ts ' + ref.id);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
