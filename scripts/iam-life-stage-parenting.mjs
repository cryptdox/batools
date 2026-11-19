#!/usr/bin/env node
/**
 * Set up Life-Stage Parenting in the live crypt-iam. Two parts; safe to re-run.
 *
 *   app   (Master realm admin) the app's own realm and client:
 *         1. realm LIFE_STAGE_PARENTING with its super admin (created if missing),
 *            self-registration on;
 *         2. PUBLIC client life-stage-parenting in that realm, with its login
 *            callback URIs (created if missing; new users get its USER role);
 *         3. prints the app's .env lines and the SQL that stores the realm's
 *            signing secret in Supabase Vault (migration 090 checks app tokens
 *            with it), and when the realm's package ends.
 *   menu  (CRYPTDOX owner) the batools Parenting menu: PARENTING_* UI_PAGE
 *         resources on the batools client and the PARENTING_ADMIN / _EDITOR /
 *         _REVIEWER roles. Additive only — never removes a permission.
 *
 *   node --env-file=.env scripts/iam-life-stage-parenting.mjs --dry-run      # show what would change
 *   node --env-file=.env scripts/iam-life-stage-parenting.mjs                # both parts
 *   node --env-file=.env scripts/iam-life-stage-parenting.mjs --only=app     # or --only=menu
 *
 * Env (all optional):
 *   IAM_URL                 default https://crypt-iam-latest.onrender.com
 *   IAM_CAPTCHA_TOKEN       only needed when IAM runs with PHASE=PROD
 *   -- app part
 *   IAM_MASTER_EMAIL        a Master realm administrator (prompted when unset)
 *   IAM_MASTER_ACCESS_CODE  iam-client's access code in the Master realm (prompted when unset)
 *   IAM_MASTER_PASSWORD     prompted for (hidden) when unset
 *   LP_REALM                default LIFE_STAGE_PARENTING
 *   LP_CLIENT_ID            default life-stage-parenting
 *   LP_ADMIN_EMAIL          the new realm's super admin, default cryptdox.ethos@gmail.com
 *   LP_ADMIN_PASSWORD       prompted for (hidden) only when the realm is created
 *   LP_REDIRECT_URIS        comma list, default the dev web app and the Android app (see below)
 *   -- menu part
 *   IAM_CLIENT_ID           default batools
 *   IAM_ACCESS_CODE         default VITE_IAM_CR_ACCESS_CODE from .env (batools @ CRYPTDOX)
 *   IAM_EMAIL               default cryptdox.ethos@gmail.com (CRYPTDOX owner — can manage resources and roles)
 *   IAM_PASSWORD            prompted for (hidden) when unset
 */
import readline from "node:readline";

const IAM_URL = (process.env.IAM_URL ?? "https://crypt-iam-latest.onrender.com").replace(/\/+$/, "");
const CAPTCHA = process.env.IAM_CAPTCHA_TOKEN || "XXXX.DUMMY.TOKEN.XXXX";
const DRY = process.argv.includes("--dry-run");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
if (ONLY && !["app", "menu"].includes(ONLY)) die("--only must be app or menu");

const LP_REALM = process.env.LP_REALM || "LIFE_STAGE_PARENTING";
const LP_CLIENT_ID = (process.env.LP_CLIENT_ID || "life-stage-parenting").toLowerCase();
const LP_ADMIN_EMAIL = process.env.LP_ADMIN_EMAIL || "cryptdox.ethos@gmail.com";
// The app's dev server (vite, port 5190) and the Android app (Capacitor serves https://localhost).
const LP_REDIRECT_URIS = (process.env.LP_REDIRECT_URIS || "http://localhost:5190/auth/callback,https://localhost/auth/callback")
  .split(",").map((s) => s.trim()).filter(Boolean);

const BATOOLS_CLIENT_ID = process.env.IAM_CLIENT_ID ?? "batools";
const BATOOLS_ACCESS_CODE = process.env.IAM_ACCESS_CODE || process.env.VITE_IAM_CR_ACCESS_CODE;
const BATOOLS_EMAIL = process.env.IAM_EMAIL || "cryptdox.ethos@gmail.com";

const TYPE = "UI_PAGE";
const ALL = ["READ", "READ_ALL", "CREATE", "UPDATE", "UPDATE_ALL", "DELETE", "DELETE_ALL"];

/** The pages (src/lib/permissions.ts → PAGE_RESOURCES, /lp/*). */
const RESOURCES = [
  "PARENTING_DASHBOARD",
  "PARENTING_FEATURES",
  "PARENTING_SETTINGS",
  "PARENTING_ANNOUNCEMENTS",
  "PARENTING_JOURNEY",
  "PARENTING_LIBRARY",
  "PARENTING_TASKS",
  "PARENTING_MILESTONES",
  "PARENTING_VACCINES",
  "PARENTING_FAMILY",
  "PARENTING_GARDEN",
  "PARENTING_REVIEW",
  "PARENTING_FEEDBACK",
];

/**
 * Roles: ADMIN (batools' own) already gets everything from IAM.
 *   PARENTING_ADMIN     runs the app: everything, including switching features and approving content.
 *   PARENTING_EDITOR    writes content; their edits go to review.
 *   PARENTING_REVIEWER  medical / Islamic reviewer: reads content, approves or rejects it (UPDATE on Review).
 */
const CONTENT = ["PARENTING_ANNOUNCEMENTS", "PARENTING_JOURNEY", "PARENTING_LIBRARY", "PARENTING_TASKS", "PARENTING_MILESTONES",
  "PARENTING_VACCINES", "PARENTING_FAMILY", "PARENTING_GARDEN"];
const MATRIX = {
  ADMIN: Object.fromEntries(RESOURCES.map((r) => [r, ALL])),
  PARENTING_ADMIN: Object.fromEntries(RESOURCES.map((r) => [r, ALL])),
  PARENTING_EDITOR: {
    PARENTING_DASHBOARD: ["READ"],
    ...Object.fromEntries(CONTENT.map((r) => [r, ALL])),
    PARENTING_REVIEW: ["READ"],
    PARENTING_FEEDBACK: ["READ", "UPDATE"],
  },
  PARENTING_REVIEWER: {
    PARENTING_DASHBOARD: ["READ"],
    ...Object.fromEntries(CONTENT.map((r) => [r, ["READ"]])),
    PARENTING_REVIEW: ["READ", "UPDATE"],
    PARENTING_FEEDBACK: ["READ"],
  },
};

const ROLE_DESCRIPTIONS = {
  PARENTING_ADMIN: "Life-Stage Parenting app: everything (features, settings, content, review)",
  PARENTING_EDITOR: "Life-Stage Parenting app: writes content; edits go to review",
  PARENTING_REVIEWER: "Life-Stage Parenting app: medical / Islamic reviewer — approves content",
};

function die(msg) {
  console.error(`✘ ${msg}`);
  process.exit(1);
}

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(s);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

async function call(token, method, urlPath, { body, headers = {} } = {}) {
  const res = await fetch(IAM_URL + urlPath, {
    method,
    headers: {
      ...(body !== undefined && { "content-type": "application/json" }),
      ...(token && { authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) die(`${method} ${urlPath} → HTTP ${res.status}: ${json?.message ?? res.statusText}`);
  return json?.data ?? json;
}

const items = (data) => (Array.isArray(data) ? data : data?.items ?? []);

async function login(email, accessCode, password) {
  const data = await call(null, "POST", "/api/auth/login", {
    headers: { "x-cr-access-code": accessCode },
    body: { email, password, captchaToken: CAPTCHA },
  });
  if (!data?.accessToken) die("Login returned no access token");
  console.log(`✔ Logged in as ${email}`);
  return data.accessToken;
}

// ── app: realm + client ──────────────────────────────────────────────────────
async function setUpApp() {
  console.log(`\n── App realm ${LP_REALM} · client ${LP_CLIENT_ID}${DRY ? " · DRY RUN" : ""}`);
  const email = process.env.IAM_MASTER_EMAIL || (await ask("Master realm admin email: "));
  const code = process.env.IAM_MASTER_ACCESS_CODE || (await ask("iam-client access code in the Master realm: "));
  const token = await login(email, code, process.env.IAM_MASTER_PASSWORD || (await ask(`IAM password for ${email}: `, true)));

  // 1. Realm
  let realm = items(await call(token, "GET", `/api/realm?search=${encodeURIComponent(LP_REALM)}&limit=100`)).find((r) => r.name === LP_REALM);
  if (realm) {
    console.log(`= realm ${LP_REALM} exists (${realm.realmId})${realm.enabled === false ? " — DISABLED: enable it in IAM" : ""}`);
  } else if (DRY) {
    console.log(`+ would create realm ${LP_REALM} with super admin ${LP_ADMIN_EMAIL}, then client ${LP_CLIENT_ID}`);
    return;
  } else {
    const password = process.env.LP_ADMIN_PASSWORD || (await ask(`New password for ${LP_REALM}'s super admin ${LP_ADMIN_EMAIL}: `, true));
    if (password.length < 8) die("Use at least 8 characters");
    realm = await call(token, "POST", "/api/realm", {
      body: {
        name: LP_REALM,
        description: "Life-Stage Parenting app users (web + Android)",
        settings: { ALLOW_REGISTRATION: true },
        superAdmin: { username: LP_ADMIN_EMAIL.split("@")[0], email: LP_ADMIN_EMAIL, password },
      },
    });
    console.log(`  ✔ realm created (${realm.realmId})`);
  }
  const realmId = realm.realmId;

  let settings = await call(token, "GET", `/api/realm/${realmId}/settings`);
  if (settings.ALLOW_REGISTRATION !== true) {
    console.log("+ turn on self-registration");
    if (!DRY) settings = await call(token, "PUT", `/api/realm/${realmId}/settings`, { body: { ALLOW_REGISTRATION: true } });
  }

  // 2. Client
  const findClient = async () => items(await call(token, "GET", `/api/client?search=${encodeURIComponent(LP_CLIENT_ID)}&realmId=${realmId}&limit=100`))
    .find((c) => c.clientId === LP_CLIENT_ID);
  let client = await findClient();
  if (client && !client.crAccessCode) die(`Client ${LP_CLIENT_ID} exists but is not in ${LP_REALM} — attach it in IAM or pick another LP_CLIENT_ID`);
  if (!client) {
    console.log(`+ create PUBLIC client ${LP_CLIENT_ID} (callbacks: ${LP_REDIRECT_URIS.join(", ")})`);
    if (DRY) return;
    await call(token, "POST", "/api/client", {
      body: { realmId, clientId: LP_CLIENT_ID, name: "Life-Stage Parenting", type: "PUBLIC", redirectUris: LP_REDIRECT_URIS },
    });
    client = await findClient();
    if (!client) die(`${LP_CLIENT_ID} was created but is not listed`);
    console.log("  ✔ client created (new users get its USER role)");
  } else {
    console.log(`= client ${LP_CLIENT_ID} exists (callback URIs are edited in IAM)`);
  }

  // 3. What the app and the database need
  const pkg = await call(token, "GET", `/api/realm/${realmId}/package`).catch(() => null);
  const expires = pkg?.packageExpiresAt ?? pkg?.expiresAt ?? realm.packageExpiresAt;

  console.log(`
── life-stage-parenting/.env
VITE_IAM_API_BASE_URL=${IAM_URL}/api
VITE_IAM_CLIENT_ID=${LP_CLIENT_ID}
VITE_IAM_CR_ACCESS_CODE=${client.crAccessCode}

── Supabase SQL editor (batools project) — stores the realm's signing secret for migration 090.
   Paste it there only; don't save it in a file or commit it.
DO $$
DECLARE s TEXT := ${sqlLiteral(settings.SECRET ?? "<SECRET not readable — copy it from IAM → realm settings>")}; r TEXT := ${sqlLiteral(realmId)};
BEGIN
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'lp_iam_jwt_secret') THEN
    PERFORM vault.update_secret(id, s) FROM vault.secrets WHERE name = 'lp_iam_jwt_secret';
  ELSE
    PERFORM vault.create_secret(s, 'lp_iam_jwt_secret', 'Life-Stage Parenting realm token secret');
  END IF;
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'lp_iam_realm_id') THEN
    PERFORM vault.update_secret(id, r) FROM vault.secrets WHERE name = 'lp_iam_realm_id';
  ELSE
    PERFORM vault.create_secret(r, 'lp_iam_realm_id', 'Life-Stage Parenting realm id');
  END IF;
END $$;
`);
  if (expires) {
    console.log(`! The realm's package ends ${new Date(expires).toISOString().slice(0, 10)} — after that nobody can sign in or register.`);
    console.log("  Assign a longer package to it in IAM (Master → Realms → Package).");
  }
}

function sqlLiteral(v) {
  return `'${String(v).replace(/'/g, "''")}'`;
}

// ── menu: batools resources + roles ────────────────────────────────────────────
async function loadPermissions(token, cid) {
  const perms = items(await call(token, "GET", `/api/permission/client/${cid}?limit=1000`));
  const map = new Map(RESOURCES.map((r) => [r, new Map()]));
  for (const p of perms) {
    if ((p.resource?.type ?? TYPE) !== TYPE) continue;
    map.get(p.resource?.name)?.set(p.action, p.permissionId);
  }
  return map;
}

async function setUpMenu() {
  console.log(`\n── batools menu · client ${BATOOLS_CLIENT_ID} · ${RESOURCES.length} Parenting pages (${TYPE})${DRY ? " · DRY RUN" : ""}`);
  if (!BATOOLS_ACCESS_CODE) die("No access code: run with --env-file=.env (VITE_IAM_CR_ACCESS_CODE) or set IAM_ACCESS_CODE");
  const token = process.env.IAM_TOKEN
    || (await login(BATOOLS_EMAIL, BATOOLS_ACCESS_CODE, process.env.IAM_PASSWORD || (await ask(`IAM password for ${BATOOLS_EMAIL}: `, true))));

  const client = items(await call(token, "GET", `/api/client?search=${encodeURIComponent(BATOOLS_CLIENT_ID)}&limit=100`)).find((c) => c.clientId === BATOOLS_CLIENT_ID);
  if (!client) die(`Client ${BATOOLS_CLIENT_ID} not found`);
  const cid = client.clientIdInternal;

  // 1. Resources + permissions
  let ids = await loadPermissions(token, cid);
  const incomplete = RESOURCES.filter((r) => ALL.some((a) => !ids.get(r).has(a)));
  if (!incomplete.length) {
    console.log(`= all ${RESOURCES.length} pages already have every action`);
  } else {
    for (const r of incomplete) console.log(`+ ${r}: ${ids.get(r).size ? "add missing actions" : `create with ${ALL.join(", ")}`}`);
    if (!DRY) {
      // One page per request: IAM creates a request's resources in one transaction with a 5 s limit.
      for (const name of incomplete) {
        await call(token, "POST", "/api/resource", {
          body: { clientId: BATOOLS_CLIENT_ID, resources: [{ name, permissions: [{ type: TYPE, actions: ALL }] }] },
        });
        console.log(`  ✔ ${name}`);
      }
      ids = await loadPermissions(token, cid);
    }
  }

  // 2. Roles
  let roles = items(await call(token, "GET", `/api/role/client/${cid}?limit=100`));
  for (const [roleName, grants] of Object.entries(MATRIX)) {
    let role = roles.find((r) => r.name === roleName);
    if (!role) {
      if (roleName === "ADMIN") {
        console.log(`\n! ADMIN: role not found on ${BATOOLS_CLIENT_ID} — skipped`);
        continue;
      }
      console.log(`\n+ ${roleName}: create role`);
      if (DRY) {
        console.log(`  would grant ${Object.values(grants).flat().length} permissions`);
        continue;
      }
      await call(token, "POST", "/api/role", { body: { clientIdInternal: cid, name: roleName, description: ROLE_DESCRIPTIONS[roleName] } });
      roles = items(await call(token, "GET", `/api/role/client/${cid}?limit=100`));
      role = roles.find((r) => r.name === roleName);
      if (!role) die(`${roleName} was created but is not listed`);
    }
    if (DRY && incomplete.length) {
      console.log(`\n${roleName}: grants after the pages exist`);
      continue;
    }
    const have = new Set(items(await call(token, "GET", `/api/permission/role/${role.roleId}?limit=1000`)).map((p) => p.permissionId));
    const missing = Object.entries(grants).flatMap(([resource, actions]) =>
      actions.filter((a) => !ids.get(resource).has(a) || !have.has(ids.get(resource).get(a))).map((a) => [resource, a]),
    );
    console.log(`\n${roleName}: ${missing.length ? `+ ${missing.length} permissions` : "= up to date"}`);
    if (!missing.length || DRY) continue;
    await call(token, "POST", `/api/permission/role/${role.roleId}/assign`, {
      body: { permissionIds: missing.map(([resource, a]) => ids.get(resource).get(a)) },
    });
    console.log(`  ✔ granted ${missing.length}`);
  }
}

async function main() {
  console.log(`IAM ${IAM_URL}`);
  if (ONLY !== "menu") await setUpApp();
  if (ONLY !== "app") await setUpMenu();
  console.log(
    DRY
      ? "\nDry run only — re-run without --dry-run to apply."
      : "\n✔ Done. Give people the PARENTING_* roles in IAM; the batools menu appears after a page reload.",
  );
}

main().catch((err) => die(err.message));
