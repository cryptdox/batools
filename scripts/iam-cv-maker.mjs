#!/usr/bin/env node
/**
 * Set up the CV Maker page in the live crypt-iam:
 *   1. create (upsert) the CV_MAKER UI_PAGE resource on the `batools` client
 *      with its actions — IAM creates the permissions and gives them all to ADMIN;
 *   2. grant the role matrix below. Additive only — never removes a permission.
 * Safe to re-run.
 *
 *   node scripts/iam-cv-maker.mjs --dry-run   # show what would change
 *   node scripts/iam-cv-maker.mjs             # do it
 *
 * Env (all optional):
 *   IAM_URL           default https://crypt-iam-latest.onrender.com
 *   IAM_CLIENT_ID     default batools
 *   IAM_ACCESS_CODE   default XfweB1 (batools @ CRYPTDOX)
 *   IAM_EMAIL         default cryptdox.ethos@gmail.com (CRYPTDOX owner — can manage resources and roles)
 *   IAM_PASSWORD      prompted for (hidden) when unset
 *   IAM_TOKEN         skip login and use this access token
 *   IAM_CAPTCHA_TOKEN only needed when IAM runs with PHASE=PROD
 */
import readline from "node:readline";

const IAM_URL = (process.env.IAM_URL ?? "https://crypt-iam-latest.onrender.com").replace(/\/+$/, "");
const CLIENT_ID = process.env.IAM_CLIENT_ID ?? "batools";
const ACCESS_CODE = process.env.IAM_ACCESS_CODE || "XfweB1";
const EMAIL = process.env.IAM_EMAIL || "cryptdox.ethos@gmail.com";
const DRY = process.argv.includes("--dry-run");

const RESOURCE = "CV_MAKER";
const TYPE = "UI_PAGE";
const ALL = ["READ", "READ_ALL", "CREATE", "UPDATE", "UPDATE_ALL", "DELETE", "DELETE_ALL"];

/** Each user only ever sees their own CVs, so anyone who can open the page can manage their CVs. */
const MATRIX = {
  ADMIN: ALL, // already granted by IAM on create; listed so a re-run repairs it
  MANAGER: ALL,
  USER: ALL,
  VIEWER: ["READ", "READ_ALL"],
  AUDITOR: ["READ", "READ_ALL"],
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

async function loadPermissions(cid) {
  const perms = items(await call("GET", `/api/permission/client/${cid}?limit=1000`));
  return new Map(
    perms
      .filter((p) => p.resource?.name === RESOURCE && (p.resource?.type ?? TYPE) === TYPE)
      .map((p) => [p.action, p.permissionId]),
  );
}

async function main() {
  console.log(`IAM ${IAM_URL} · client ${CLIENT_ID} · ${RESOURCE} (${TYPE})${DRY ? " · DRY RUN" : ""}`);
  await login();

  const client = items(await call("GET", `/api/client?search=${encodeURIComponent(CLIENT_ID)}&limit=100`)).find((c) => c.clientId === CLIENT_ID);
  if (!client) die(`Client ${CLIENT_ID} not found`);
  const cid = client.clientIdInternal;

  // 1. Resource + permissions
  let idOf = await loadPermissions(cid);
  const missingActions = ALL.filter((a) => !idOf.has(a));
  if (!missingActions.length) {
    console.log(`= ${RESOURCE} already has all ${ALL.length} actions`);
  } else {
    console.log(`+ ${RESOURCE}: ${idOf.size ? `add actions ${missingActions.join(", ")}` : `create with ${ALL.join(", ")}`}`);
    if (!DRY) {
      await call("POST", "/api/resource", {
        body: { clientId: CLIENT_ID, resources: [{ name: RESOURCE, permissions: [{ type: TYPE, actions: ALL }] }] },
      });
      idOf = await loadPermissions(cid);
      console.log(`  ✔ ${RESOURCE} ready (${idOf.size} permissions, all given to ADMIN)`);
    }
  }

  // 2. Roles
  const roles = items(await call("GET", `/api/role/client/${cid}?limit=100`));
  for (const [roleName, actions] of Object.entries(MATRIX)) {
    const role = roles.find((r) => r.name === roleName);
    if (!role) {
      console.log(`\n! ${roleName}: role not found on ${CLIENT_ID} — skipped`);
      continue;
    }
    const have = new Set(items(await call("GET", `/api/permission/role/${role.roleId}?limit=1000`)).map((p) => p.permissionId));
    // In a dry run before the resource exists, every action is still missing.
    const missing = actions.filter((a) => !idOf.has(a) || !have.has(idOf.get(a)));
    console.log(`\n${roleName}: ${missing.length ? `+ ${missing.join(", ")}` : "= up to date"}`);
    if (!missing.length || DRY) continue;
    await call("POST", `/api/permission/role/${role.roleId}/assign`, { body: { permissionIds: missing.map((a) => idOf.get(a)) } });
    console.log(`  ✔ granted ${missing.length}`);
  }

  console.log(DRY ? "\nDry run only — re-run without --dry-run to apply." : "\n✔ Done. Users see CV Maker after a page reload (or sign out and in on older batools builds).");
}

main().catch((err) => die(err.message));
