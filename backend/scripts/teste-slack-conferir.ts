/** Confere o estado de uma requisicao de teste depois da decisao no Slack. */
import { collections } from '../src/firebase';

const id = process.argv[2];

async function main(): Promise<void> {
  const snap = await collections.requests().doc(id).get();
  if (!snap.exists) {
    console.log('requisicao nao existe mais: ' + id);
    return;
  }
  const d = snap.data() ?? {};
  console.log('status.............: ' + d.status);
  console.log('decision...........: ' + (d.decision ? JSON.stringify(d.decision) : '(nenhuma)'));
  console.log('slack.adminChannel.: ' + (d.slack?.adminChannel ?? '-'));
  console.log('slack.adminMsgTs...: ' + (d.slack?.adminMessageTs ?? '-'));
  console.log('unread.............: ' + JSON.stringify(d.unread));

  const ev = await collections.events(id).orderBy('createdAt', 'asc').get();
  console.log('eventos............: ' + ev.size);
  for (const doc of ev.docs) {
    const e = doc.data();
    console.log('   - ' + e.type + ' por ' + e.authorName + ' (' + e.authorRole + ')' + (e.text ? ' — "' + e.text + '"' : ''));
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
