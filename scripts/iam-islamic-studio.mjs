#!/usr/bin/env node
/**
 * Set up the Islamic Studio menu in the live crypt-iam:
 *   1. create (upsert) its UI_PAGE resources on the `batools` client with
 *      every action — IAM creates the permissions and gives them all to ADMIN;
 *   2. create the three Islamic Studio roles if missing and grant the matrix
 *      below. Additive only — never removes a permission.
 * Safe to re-run.
 *
 *   node --env-file=.env scripts/iam-islamic-studio.mjs --dry-run   # show what would change
 *   node --env-file=.env scripts/iam-islamic-studio.mjs             # do it
 *
 * Run from the app folder: values come from its .env (Node 20.6+ --env-file).
 *
 * Env (all optional):
 *   IAM_URL           default https://crypt-iam-latest.onrender.com
 *   IAM_CLIENT_ID     default batools
 *   IAM_ACCESS_CODE   default VITE_IAM_CR_ACCESS_CODE from .env (batools @ CRYPTDOX)
 *   IAM_EMAIL         default cryptdox.ethos@gmail.com (CRYPTDOX owner — can manage resources and roles)
 *   IAM_PASSWORD      prompted for (hidden) when unset
 *   IAM_TOKEN         skip login and use this access token
 *   IAM_CAPTCHA_TOKEN only needed when IAM runs with PHASE=PROD
 */
import readline from "node:readline";

const IAM_URL = (process.env.IAM_URL ?? "https://crypt-iam-latest.onrender.com").replace(/\/+$/, "");
const CLIENT_ID = process.env.IAM_CLIENT_ID ?? "batools";
const ACCESS_CODE = process.env.IAM_ACCESS_CODE || process.env.VITE_IAM_CR_ACCESS_CODE;
const EMAIL = process.env.IAM_EMAIL || "cryptdox.ethos@gmail.com";
const DRY = process.argv.includes("--dry-run");

const TYPE = "UI_PAGE";
const ALL = ["READ", "READ_ALL", "CREATE", "UPDATE", "UPDATE_ALL", "DELETE", "DELETE_ALL"];

/** The pages (src/lib/permissions.ts → PAGE_RESOURCES, /is/*). Re-running adds only what is missing. */
const RESOURCES = [
  "ISLAMIC_STUDIO_DASHBOARD",
  "ISLAMIC_STUDIO_FEATURES",
  "ISLAMIC_STUDIO_SETTINGS",
  "ISLAMIC_STUDIO_ANNOUNCEMENTS",
  "ISLAMIC_STUDIO_PRAYER",
  "ISLAMIC_STUDIO_CALENDAR",
  "ISLAMIC_STUDIO_DUAS",
  "ISLAMIC_STUDIO_QURAN",
  "ISLAMIC_STUDIO_REVIEW",
  "ISLAMIC_STUDIO_FEEDBACK",
  "ISLAMIC_STUDIO_QUIZ",
  "ISLAMIC_STUDIO_ZAKAT",
  "ISLAMIC_STUDIO_TRACKER",
  "ISLAMIC_STUDIO_SCORES",
];

/**
 * Roles: ADMIN (batools' own) already gets everything from IAM.
 *   ISLAMIC_STUDIO_ADMIN   runs the app: everything, including switching features and approving content.
 *   ISLAMIC_STUDIO_EDITOR  writes content (announcements, prayer, calendar, duas, Quran); their edits go to review.
 *   ISLAMIC_STUDIO_SCHOLAR reviews: reads content, approves or rejects it (UPDATE on Content Review).
 */
const MATRIX = {
  ADMIN: Object.fromEntries(RESOURCES.map((r) => [r, ALL])),
  ISLAMIC_STUDIO_ADMIN: Object.fromEntries(RESOURCES.map((r) => [r, ALL])),
  ISLAMIC_STUDIO_EDITOR: {
    ISLAMIC_STUDIO_DASHBOARD: ["READ"],
    ISLAMIC_STUDIO_ANNOUNCEMENTS: ALL,
    ISLAMIC_STUDIO_PRAYER: ALL,
    ISLAMIC_STUDIO_CALENDAR: ALL,
    ISLAMIC_STUDIO_DUAS: ALL,
    ISLAMIC_STUDIO_QURAN: ALL,
    ISLAMIC_STUDIO_REVIEW: ["READ"],
    ISLAMIC_STUDIO_FEEDBACK: ["READ", "UPDATE"],
    ISLAMIC_STUDIO_QUIZ: ALL,
    ISLAMIC_STUDIO_ZAKAT: ALL,
    ISLAMIC_STUDIO_TRACKER: ALL,
    ISLAMIC_STUDIO_SCORES: ["READ"],
  },
  ISLAMIC_STUDIO_SCHOLAR: {
    ISLAMIC_STUDIO_DASHBOARD: ["READ"],
    ISLAMIC_STUDIO_DUAS: ["READ"],
    ISLAMIC_STUDIO_QURAN: ["READ"],
    ISLAMIC_STUDIO_REVIEW: ["READ", "UPDATE"],
    ISLAMIC_STUDIO_QUIZ: ["READ"],
    ISLAMIC_STUDIO_ZAKAT: ["READ"],
  },
};

const ROLE_DESCRIPTIONS = {
  ISLAMIC_STUDIO_ADMIN: "Islamic Studio app: everything (features, settings, content, review)",
  ISLAMIC_STUDIO_EDITOR: "Islamic Studio app: writes content; edits go to review",
  ISLAMIC_STUDIO_SCHOLAR: "Islamic Studio app: reviews and approves religious content",
};

let token = process.env.IAM_TOKEN ?? "";

function die(msg) {
  console.error(`✘ ${msg}`);
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(question)) rl.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function call(method, urlPath, { body, headers = {}, auth = true } = {}) {
  const res = await fetch(IAM_URL + urlPath, {
    method,
    headers: {
      ...(body !== undefined && { "content-type": "application/json" }),
      ...(auth && { authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) die(`${method} ${urlPath} → HTTP ${res.status}: ${json?.message ?? res.statusText}`);
  return json?.data ?? json;
}

const items = (data) => (Array.isArray(data) ? data : data?.items ?? []);

async function login() {
  if (token) return;
  const password = process.env.IAM_PASSWORD || (await askHidden(`IAM password for ${EMAIL}: `));
  const data = await call("POST", "/api/auth/login", {
    auth: false,
    headers: { "x-cr-access-code": ACCESS_CODE },
    body: { email: EMAIL, password, captchaToken: process.env.IAM_CAPTCHA_TOKEN || "XXXX.DUMMY.TOKEN.XXXX" },
  });
  token = data.accessToken;
  if (!token) die("Login returned no access token");
  console.log(`✔ Logged in as ${EMAIL}`);
}

/** resource → action → permissionId, for the Islamic Studio pages. */
async function loadPermissions(cid) {
  const perms = items(await call("GET", `/api/permission/client/${cid}?limit=1000`));
  const map = new Map(RESOURCES.map((r) => [r, new Map()]));
  for (const p of perms) {
    if ((p.resource?.type ?? TYPE) !== TYPE) continue;
    map.get(p.resource?.name)?.set(p.action, p.permissionId);
  }
  return map;
}

async function main() {
  if (!ACCESS_CODE) die("No access code: run with --env-file=.env (VITE_IAM_CR_ACCESS_CODE) or set IAM_ACCESS_CODE");
  console.log(`IAM ${IAM_URL} · client ${CLIENT_ID} · ${RESOURCES.length} Islamic Studio pages (${TYPE})${DRY ? " · DRY RUN" : ""}`);
  await login();

  const client = items(await call("GET", `/api/client?search=${encodeURIComponent(CLIENT_ID)}&limit=100`)).find((c) => c.clientId === CLIENT_ID);
  if (!client) die(`Client ${CLIENT_ID} not found`);
  const cid = client.clientIdInternal;

  // 1. Resources + permissions
  let ids = await loadPermissions(cid);
  const incomplete = RESOURCES.filter((r) => ALL.some((a) => !ids.get(r).has(a)));
  if (!incomplete.length) {
    console.log(`= all ${RESOURCES.length} pages already have every action`);
  } else {
    for (const r of incomplete) console.log(`+ ${r}: ${ids.get(r).size ? "add missing actions" : `create with ${ALL.join(", ")}`}`);
    if (!DRY) {
      // One page per request: IAM creates a request's resources in one transaction with a
      // 5 s limit, which ten pages at once overran on the hosted IAM.
      for (const name of incomplete) {
        await call("POST", "/api/resource", {
          body: { clientId: CLIENT_ID, resources: [{ name, permissions: [{ type: TYPE, actions: ALL }] }] },
        });
        console.log(`  ✔ ${name}`);
      }
      ids = await loadPermissions(cid);
      console.log(`  ✔ ${incomplete.length} pages ready (all given to ADMIN)`);
    }
  }

  // 2. Roles
  let roles = items(await call("GET", `/api/role/client/${cid}?limit=100`));
  for (const [roleName, grants] of Object.entries(MATRIX)) {
    let role = roles.find((r) => r.name === roleName);
    if (!role) {
      if (roleName === "ADMIN") {
        console.log(`\n! ADMIN: role not found on ${CLIENT_ID} — skipped`);
        continue;
      }
      console.log(`\n+ ${roleName}: create role`);
      if (DRY) {
        console.log(`  would grant ${Object.values(grants).flat().length} permissions`);
        continue;
      }
      await call("POST", "/api/role", { body: { clientIdInternal: cid, name: roleName, description: ROLE_DESCRIPTIONS[roleName] } });
      roles = items(await call("GET", `/api/role/client/${cid}?limit=100`));
      role = roles.find((r) => r.name === roleName);
      if (!role) die(`${roleName} was created but is not listed`);
    }
    const have = new Set(items(await call("GET", `/api/permission/role/${role.roleId}?limit=1000`)).map((p) => p.permissionId));
    const missing = Object.entries(grants).flatMap(([resource, actions]) =>
      actions.filter((a) => !ids.get(resource).has(a) || !have.has(ids.get(resource).get(a))).map((a) => [resource, a]),
    );
    console.log(`\n${roleName}: ${missing.length ? `+ ${missing.length} permissions` : "= up to date"}`);
    if (!missing.length || DRY) continue;
    await call("POST", `/api/permission/role/${role.roleId}/assign`, {
      body: { permissionIds: missing.map(([resource, a]) => ids.get(resource).get(a)) },
    });
    console.log(`  ✔ granted ${missing.length}`);
  }

  console.log(
    DRY
      ? "\nDry run only — re-run without --dry-run to apply."
      : "\n✔ Done. Give people the ISLAMIC_STUDIO_* roles in IAM; the menu appears after a page reload.",
  );
}

main().catch((err) => die(err.message));
