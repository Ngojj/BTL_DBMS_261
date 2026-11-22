/**
 * TicketRush - Cloud Firestore Enterprise indexing benchmark helper.
 *
 * Usage (from repository root):
 *   node scripts/firestore-cloud-benchmark.js seed --per-event 400
 *   node scripts/firestore-cloud-benchmark.js explain --event-id 2 --checked-in false --runs 10 --label no-index --force-index primary
 *   node scripts/firestore-cloud-benchmark.js explain --event-id 2 --checked-in false --runs 10 --label with-index --force-index CICAgOjXh4EK
 *
 * Safety:
 * - Reads source records from PostgreSQL (backend/.env DATABASE_URL).
 * - Writes ONLY to Cloud Firestore project ticketrush-auth-lab / database default.
 * - Uses the standalone @google-cloud/firestore client with Pipeline Query Explain.
 * - Explicitly removes FIRESTORE_EMULATOR_HOST in this process before initializing Admin SDK.
 * - Refuses to seed if Cloud collection validTickets already contains a document.
 * - Does not modify the Firestore Emulator, PostgreSQL, or the app's firebase config.
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND_ENV = path.join(ROOT, 'backend', '.env');
const PROJECT_ID = 'ticketrush-auth-lab';
const DATABASE_ID = 'default';
const COLLECTION = 'validTickets';

// Resolve backend dependencies from backend/node_modules, because this script
// lives in the repository-level scripts/ folder (not backend/).
const requireBackend = createRequire(path.join(ROOT, 'backend', 'package.json'));

function option(name, fallback) {
  const args = process.argv.slice(3);
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const value = args[i + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for --${name}`);
  return value;
}

function printHelp() {
  console.log(`\nTicketRush Cloud Firestore Enterprise benchmark\n\nCommands:\n  seed [--per-event 400]\n  explain --event-id 2 --checked-in false [--runs 10] [--label no-index|with-index] [--force-index primary|INDEX_ID]\n\nUse --force-index primary to force a TableScan (No Index plan).\nUse --force-index INDEX_ID to force a specific composite index.\nThe script targets Cloud project ${PROJECT_ID}, database ${DATABASE_ID}, collection ${COLLECTION}.\nIt never writes to the Firestore Emulator.\n`);
}

async function loadEnvironment() {
  await access(BACKEND_ENV);
  process.loadEnvFile(BACKEND_ENV);

  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID !== PROJECT_ID) {
    throw new Error(
      `backend/.env FIREBASE_PROJECT_ID is ${process.env.FIREBASE_PROJECT_ID}, expected ${PROJECT_ID}. ` +
      'Refusing to continue.'
    );
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) {
    throw new Error(
      'GOOGLE_APPLICATION_CREDENTIALS is missing in backend/.env. ' +
      'Point it to the service-account JSON for ticketrush-auth-lab.'
    );
  }
  const absoluteCredentialsPath = path.resolve(ROOT, credentialsPath);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = absoluteCredentialsPath;
  await access(absoluteCredentialsPath);

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(await readFile(absoluteCredentialsPath, 'utf8'));
  } catch {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS does not point to a valid JSON service-account key.');
  }
  if (serviceAccount.project_id !== PROJECT_ID) {
    throw new Error(
      `Service-account JSON belongs to ${serviceAccount.project_id ?? 'an unknown project'}, not ${PROJECT_ID}. ` +
      'Refusing to write to the wrong project.'
    );
  }

  // The app normally targets the Emulator when this variable exists. This standalone
  // benchmark process targets Cloud Firestore, so remove it before creating its own client.
  // The user's normal backend process is unaffected.
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

  return { absoluteCredentialsPath, emulatorHost };
}

async function createCloudFirestore(absoluteCredentialsPath) {
  // Firestore Enterprise Query Explain is available through Pipeline operations,
  // not Query.explain() / the RunQuery API. Use a current standalone Firestore
  // server client so the benchmark can use db.pipeline().
  let firestoreModule;
  let pipelineModule;
  try {
    firestoreModule = requireBackend('@google-cloud/firestore');
    pipelineModule = requireBackend('@google-cloud/firestore/pipelines');
  } catch (error) {
    throw new Error(
      'The installed @google-cloud/firestore package does not expose the Pipeline API. ' +
      'Install the benchmark-compatible client with: npm --prefix backend install @google-cloud/firestore@^9.4.1. ' +
      `Original module error: ${error.message}`
    );
  }

  const { Firestore } = firestoreModule;
  const { field, and } = pipelineModule;
  if (typeof Firestore !== 'function' || typeof field !== 'function' || typeof and !== 'function') {
    throw new Error(
      'The installed @google-cloud/firestore package is too old or incomplete for Firestore Enterprise Pipeline operations. ' +
      'Run: npm --prefix backend install @google-cloud/firestore@^9.4.1'
    );
  }

  const db = new Firestore({
    projectId: PROJECT_ID,
    databaseId: DATABASE_ID,
    keyFilename: absoluteCredentialsPath,
  });
  if (typeof db.pipeline !== 'function') {
    await db.terminate().catch(() => {});
    throw new Error(
      'db.pipeline() is unavailable in the installed Firestore client. ' +
      'Run: npm --prefix backend install @google-cloud/firestore@^9.4.1'
    );
  }
  return { db, field, and };
}

async function seed(db) {
  const perEvent = Number(option('per-event', '400'));
  if (!Number.isSafeInteger(perEvent) || perEvent < 1 || perEvent > 2000) {
    throw new Error('--per-event must be an integer between 1 and 2000.');
  }

  const collection = db.collection(COLLECTION);
  let existing;
  try {
    existing = await collection.limit(1).get();
  } catch (error) {
    error.message = `Firestore connection/read probe failed for projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${COLLECTION}: ${error.message}`;
    throw error;
  }
  if (!existing.empty) {
    throw new Error(
      `Cloud collection ${COLLECTION} is not empty. No data was changed. ` +
      'Review the existing Cloud documents before deciding whether to clear them.'
    );
  }

  const pgConfigUrl = pathToFileURL(path.join(ROOT, 'backend', 'src', 'config', 'pg.js')).href;
  const { pool } = await import(pgConfigUrl);
  try {
    const databaseCheck = await pool.query('SELECT current_database() AS database_name');
    const sourceDatabase = databaseCheck.rows[0]?.database_name;
    if (sourceDatabase !== 'ticketrush_benchmark') {
      throw new Error(
        `DATABASE_URL currently points to ${sourceDatabase ?? 'an unknown database'}, not ticketrush_benchmark. ` +
        'Update backend/.env DATABASE_URL to the dedicated benchmark database before seeding Cloud.'
      );
    }

    const sql = `
      WITH ranked_tickets AS (
        SELECT
          t.ticket_id,
          t.qr_code,
          t.status,
          t.checked_in_at,
          o.event_id,
          u.full_name,
          z.name AS zone_name,
          s.row_label,
          s.seat_no,
          ROW_NUMBER() OVER (
            PARTITION BY o.event_id
            ORDER BY t.ticket_id
          ) AS rn
        FROM tickets AS t
        JOIN orders AS o ON o.order_id = t.order_id
        JOIN users AS u ON u.user_id = o.user_id
        JOIN seats AS s ON s.seat_id = t.seat_id
        JOIN zones AS z ON z.zone_id = s.zone_id
        WHERE t.status <> 'CANCELLED'
      )
      SELECT ticket_id, qr_code, status, checked_in_at, event_id,
             full_name, zone_name, row_label, seat_no
      FROM ranked_tickets
      WHERE rn <= $1
      ORDER BY event_id, ticket_id
    `;

    const { rows } = await pool.query(sql, [perEvent]);
    if (rows.length === 0) throw new Error('The PostgreSQL sample query returned no tickets.');

    const distinctEvents = new Set(rows.map((row) => String(row.event_id)));
    const expectedUpperBound = perEvent * distinctEvents.size;
    console.log(`\nSource PostgreSQL records selected: ${rows.length}`);
    console.log(`Events represented: ${distinctEvents.size}`);
    console.log(`Maximum planned sample: ${expectedUpperBound} (${perEvent} per event)`);
    console.log(`Destination: ${PROJECT_ID}/${DATABASE_ID}/${COLLECTION}`);

    const writer = db.bulkWriter();
    let scheduled = 0;
    for (const row of rows) {
      const qrCode = String(row.qr_code ?? '').trim();
      if (!qrCode) throw new Error(`Ticket ${row.ticket_id} has an empty qr_code.`);
      writer.set(collection.doc(qrCode), {
        eventId: String(row.event_id),
        seatLabel: `${row.zone_name} · Ghế ${row.row_label}${row.seat_no}`,
        holderName: row.full_name ?? null,
        checkedIn: row.status === 'CHECKED_IN',
        checkedInAt: row.checked_in_at ?? null,
      });
      scheduled += 1;
    }

    await writer.close();

    const outDir = path.join(ROOT, 'backend', 'lab-results', 'firestore-indexing');
    await mkdir(outDir, { recursive: true });
    const manifest = {
      projectId: PROJECT_ID,
      databaseId: DATABASE_ID,
      collection: COLLECTION,
      sourceDatabase: 'ticketrush_benchmark (PostgreSQL)',
      perEvent,
      eventsRepresented: distinctEvents.size,
      documentsWritten: scheduled,
      createdAt: new Date().toISOString(),
      note: 'Data copied to Cloud Firestore only. Firestore Emulator and PostgreSQL were not modified.',
    };
    const manifestPath = path.join(outDir, 'seed-manifest.json');
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    console.log('\nSeed completed successfully.');
    console.log(JSON.stringify(manifest, null, 2));
    console.log(`Manifest: ${manifestPath}`);
  } finally {
    await pool.end().catch(() => {});
  }
}

async function explain(db, field, and) {
  const eventId = option('event-id', '2');
  const checkedInRaw = option('checked-in', 'false').toLowerCase();
  const runs = Number(option('runs', '3'));
  const label = option('label', 'manual');
  const forceIndex = option('force-index', '');

  if (!/^\d+$/.test(eventId)) throw new Error('--event-id must be a positive integer.');
  if (!['true', 'false'].includes(checkedInRaw)) throw new Error('--checked-in must be true or false.');
  if (!Number.isSafeInteger(runs) || runs < 1 || runs > 10) {
    throw new Error('--runs must be an integer between 1 and 10.');
  }
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(label)) throw new Error('--label may contain only letters, numbers, _ and -.');
  if (forceIndex && !/^[a-zA-Z0-9_-]{1,100}$/.test(forceIndex)) {
    throw new Error('--force-index must be "primary" or a valid Firestore index ID.');
  }

  // Firestore Enterprise rejects Query.explain() because it uses RunQuery.
  // Pipeline.execute() sends ExecutePipeline, which supports explainOptions.
  // forceIndex='primary' makes the no-index/TableScan baseline reproducible
  // without deleting the existing index; an exact index ID forces that index.
  const source = forceIndex
    ? db.pipeline().collection({ collection: `/${COLLECTION}`, forceIndex })
    : db.pipeline().collection(`/${COLLECTION}`);
  console.log(`Execution plan hint: ${forceIndex === 'primary' ? 'forced TableScan (no secondary index)' : forceIndex ? `forced index ${forceIndex}` : 'automatic planner'}`);
  const pipeline = source.where(and(
    field('eventId').equal(String(eventId)),
    field('checkedIn').equal(checkedInRaw === 'true'),
  ));

  const records = [];
  for (let i = 1; i <= runs; i += 1) {
    const started = performance.now();
    const result = await pipeline.execute({
      explainOptions: { mode: 'analyze', outputFormat: 'text' },
    });
    const clientWallMs = Number((performance.now() - started).toFixed(3));
    const explainText = result?.explainStats?.text ?? null;
    const resultsReturned = Array.isArray(result?.results) ? result.results.length : null;

    if (typeof explainText !== 'string' || explainText.length === 0) {
      throw new Error(
        'Pipeline executed, but Firestore did not return explainStats.text. ' +
        'Check the installed @google-cloud/firestore version and database edition.'
      );
    }

    const record = {
      run: i,
      clientWallMs,
      resultsReturned,
      explainText,
    };
    records.push(record);
    console.log(`\nRun ${i}/${runs}`);
    console.log(`Client wall time: ${clientWallMs} ms`);
    console.log(`Results returned: ${resultsReturned ?? 'not exposed by SDK'}`);
    console.log('Query Explain:');
    console.log(explainText);
  }

  const payload = {
    projectId: PROJECT_ID,
    databaseId: DATABASE_ID,
    collection: COLLECTION,
    query: {
      eventId: String(eventId),
      checkedIn: checkedInRaw === 'true',
    },
    label,
    forceIndex: forceIndex || null,
    planMode: forceIndex === 'primary' ? 'forced-table-scan' : forceIndex ? 'forced-index' : 'automatic-planner',
    api: 'Firestore Enterprise Pipeline / ExecutePipeline',
    explainMode: 'analyze',
    createdAt: new Date().toISOString(),
    runs: records,
    note: 'Query Explain text contains Firestore backend execution and scan metrics. clientWallMs includes client/network overhead; do not treat them as the same metric.',
  };

  const outDir = path.join(ROOT, 'backend', 'lab-results', 'firestore-indexing');
  await mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, `explain-${label}-${Date.now()}.json`);
  await writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`\nSaved Explain report: ${outputPath}`);
}

async function main() {
  const command = process.argv[2];
  if (!command || command === '--help' || command === 'help') {
    printHelp();
    return;
  }
  if (!['seed', 'explain'].includes(command)) {
    printHelp();
    throw new Error(`Unknown command: ${command}`);
  }

  const { emulatorHost, absoluteCredentialsPath } = await loadEnvironment();
  console.log(`Project safeguard: ${PROJECT_ID}/${DATABASE_ID}`);
  console.log(`Firestore resource: projects/${PROJECT_ID}/databases/${DATABASE_ID}`);
  console.log(`FIRESTORE_EMULATOR_HOST was ${emulatorHost ? `set to ${emulatorHost}` : 'not set'} in backend/.env; it is removed in this child process.`);
  const { db, field, and } = await createCloudFirestore(absoluteCredentialsPath);

  try {
    if (command === 'seed') await seed(db);
    else await explain(db, field, and);
  } finally {
    await db.terminate().catch(() => {});
  }
}

main().catch((error) => {
  console.error('\nERROR:', error.message);
  if (error.code !== undefined) console.error('Error code:', error.code);
  if (error.details) console.error('Error details:', error.details);
  if (error.note) console.error('Error note:', error.note);
  if (error.cause) console.error('Underlying cause:', error.cause);
  if (error.metadata) console.error('Error metadata:', error.metadata);
  if (error.stack) console.error('Stack:', error.stack);
  process.exitCode = 1;
});
