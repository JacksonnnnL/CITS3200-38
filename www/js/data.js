// ========================================
// OsteoMap Data Layer — IndexedDB
// ========================================
//
// Local-only persistence for the offline-first app. No server, no cloud.
// Schema (see Scope of Work "Proposed Record Structure"):
//
//   Site --< Context (optional) --< Accession (skeleton record) --< ZoneState
//
// Site codes must be unique (enforced by a unique index — duplicate
// inserts throw DuplicateSiteCodeError so the UI can show the required
// "already exists, modify or start new" warning).
//
// Preservation states and age categories are exported as constants
// (not hard-coded inline) so labels/colours can change later without
// touching this file — see Risk Register: "Preservation states are not
// clearly defined".
// ========================================

const DB_NAME = "osteomap";
const DB_VERSION = 1;

export const PRESERVATION_STATES = Object.freeze({
  PRESENT_COMPLETE: "present-complete",
  PRESENT_FRAGMENTED: "present-fragmented",
  ABSENT: "absent",
});

export const AGE_CATEGORIES = Object.freeze({
  INFANT: "infant",
  CHILD: "child",
  ADOLESCENT: "adolescent",
  ADULT: "adult",
});

export class DuplicateSiteCodeError extends Error {
  constructor(code) {
    super(`Site code "${code}" already exists`);
    this.name = "DuplicateSiteCodeError";
    this.code = code;
  }
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

// ========================================
// Connection handling
// ========================================

let dbPromise = null;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("sites")) {
        const sites = db.createObjectStore("sites", { keyPath: "id" });
        sites.createIndex("code", "code", { unique: true });
      }

      if (!db.objectStoreNames.contains("contexts")) {
        const contexts = db.createObjectStore("contexts", { keyPath: "id" });
        contexts.createIndex("siteId", "siteId", { unique: false });
      }

      if (!db.objectStoreNames.contains("accessions")) {
        const accessions = db.createObjectStore("accessions", { keyPath: "id" });
        accessions.createIndex("siteId", "siteId", { unique: false });
        accessions.createIndex("contextId", "contextId", { unique: false });
      }

      if (!db.objectStoreNames.contains("zoneStates")) {
        const zoneStates = db.createObjectStore("zoneStates", { keyPath: "id" });
        zoneStates.createIndex("accessionId", "accessionId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getDb() {
  if (!dbPromise) {
    dbPromise = openDatabase();
  }
  return dbPromise;
}

// Test-only: forces the next call to re-open the connection. Needed because
// this module caches a single connection, and tests swap out the global
// `indexedDB` (e.g. fake-indexeddb) between cases to keep them isolated.
export function __resetConnectionForTests() {
  dbPromise = null;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => {
      // Without this, an unhandled request error aborts the whole
      // transaction, and the transaction's own onabort/onerror can then
      // win the race to settle this promise — with tx.error, which is
      // sometimes null instead of the real DOMException (e.g. the
      // ConstraintError from a duplicate site code). We're handling the
      // error ourselves via rejection, so stop that default abort and
      // reject with the specific request error instead.
      event.preventDefault();
      reject(request.error);
    };
  });
}

async function withStore(storeName, mode, fn) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;

    Promise.resolve(fn(store))
      .then((r) => {
        result = r;
      })
      .catch(reject);

    // Only oncomplete/onabort settle this promise. tx.onerror fires for
    // every bubbled request error, even ones we've deliberately handled
    // and prevented from aborting (see requestToPromise) — treating it as
    // fatal here raced a spurious reject(null) ahead of both the real
    // error (from fn's own rejection, below) and the eventual successful
    // oncomplete.
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error);
  });
}

function newId() {
  return crypto.randomUUID();
}

// ========================================
// Site Operations
// ========================================

export async function createSite({ code, description = "" }) {
  const trimmedCode = (code || "").trim();

  if (!trimmedCode) {
    throw new ValidationError("Site code is required");
  }

  const site = {
    id: newId(),
    code: trimmedCode,
    description,
    createdAt: new Date().toISOString(),
  };

  try {
    await withStore("sites", "readwrite", (store) => requestToPromise(store.add(site)));
  } catch (err) {
    if (err && err.name === "ConstraintError") {
      throw new DuplicateSiteCodeError(trimmedCode);
    }
    throw err;
  }

  return site;
}

export async function updateSite(id, updates) {
  return withStore("sites", "readwrite", async (store) => {
    const existing = await requestToPromise(store.get(id));
    if (!existing) return null;
    const updated = { ...existing, ...updates, id };
    await requestToPromise(store.put(updated));
    return updated;
  });
}

export async function getSites() {
  const sites = await withStore("sites", "readonly", (store) => requestToPromise(store.getAll()));
  return sites.sort((a, b) => a.code.localeCompare(b.code));
}

export async function getSiteById(id) {
  return withStore("sites", "readonly", (store) => requestToPromise(store.get(id)));
}

export async function getSiteByCode(code) {
  return withStore("sites", "readonly", (store) =>
    requestToPromise(store.index("code").get(code))
  );
}

export async function deleteSite(id) {
  const accessions = await getAccessionsBySite(id);
  for (const accession of accessions) {
    await deleteAccession(accession.id);
  }

  const contexts = await getContextsBySite(id);
  await withStore("contexts", "readwrite", async (store) => {
    for (const context of contexts) {
      await requestToPromise(store.delete(context.id));
    }
  });

  await withStore("sites", "readwrite", (store) => requestToPromise(store.delete(id)));
}

// ========================================
// Context / Grave Operations
// ========================================

export async function createContext({ siteId, code, notes = "" }) {
  if (!siteId) throw new ValidationError("siteId is required");
  const trimmedCode = (code || "").trim();
  if (!trimmedCode) throw new ValidationError("Context code is required");

  const context = {
    id: newId(),
    siteId,
    code: trimmedCode,
    notes,
    createdAt: new Date().toISOString(),
  };

  await withStore("contexts", "readwrite", (store) => requestToPromise(store.add(context)));
  return context;
}

export async function getContextsBySite(siteId) {
  return withStore("contexts", "readonly", (store) =>
    requestToPromise(store.index("siteId").getAll(siteId))
  );
}

export async function deleteContext(id) {
  await withStore("contexts", "readwrite", (store) => requestToPromise(store.delete(id)));
}

// ========================================
// Accession (Skeleton Record) Operations
// ========================================

export async function createAccession({
  siteId,
  contextId = null,
  accessionNumber,
  date = "",
  notes = "",
  ageCategory,
}) {
  if (!siteId) throw new ValidationError("siteId is required");

  const trimmedNumber = (accessionNumber || "").trim();
  if (!trimmedNumber) throw new ValidationError("Accession number is required");

  if (ageCategory && !Object.values(AGE_CATEGORIES).includes(ageCategory)) {
    throw new ValidationError(`Invalid age category: ${ageCategory}`);
  }

  const accession = {
    id: newId(),
    siteId,
    contextId,
    accessionNumber: trimmedNumber,
    date,
    notes,
    ageCategory,
    createdAt: new Date().toISOString(),
  };

  await withStore("accessions", "readwrite", (store) => requestToPromise(store.add(accession)));
  return accession;
}

export async function updateAccession(id, updates) {
  return withStore("accessions", "readwrite", async (store) => {
    const existing = await requestToPromise(store.get(id));
    if (!existing) return null;
    const updated = { ...existing, ...updates, id };
    await requestToPromise(store.put(updated));
    return updated;
  });
}

export async function getAccessionsBySite(siteId) {
  return withStore("accessions", "readonly", (store) =>
    requestToPromise(store.index("siteId").getAll(siteId))
  );
}

export async function getAccessionById(id) {
  return withStore("accessions", "readonly", (store) => requestToPromise(store.get(id)));
}

export async function deleteAccession(id) {
  const zoneStates = await getZoneStatesByAccession(id);
  await withStore("zoneStates", "readwrite", async (store) => {
    for (const zoneState of zoneStates) {
      await requestToPromise(store.delete(zoneState.id));
    }
  });

  await withStore("accessions", "readwrite", (store) => requestToPromise(store.delete(id)));
}

// ========================================
// Zone State Operations
// ========================================
//
// A zone's id is derived deterministically from its coordinates
// (accession + bone + side + zone) so setting a state is a plain
// upsert — no need to look up an existing row first.

function zoneStateId(accessionId, bone, side, zone) {
  return [accessionId, bone, side || "", zone].join("|");
}

export async function setZoneState({ accessionId, bone, side = "", zone, state }) {
  if (!accessionId) throw new ValidationError("accessionId is required");
  if (!bone) throw new ValidationError("bone is required");
  if (!zone) throw new ValidationError("zone is required");

  if (!Object.values(PRESERVATION_STATES).includes(state)) {
    throw new ValidationError(`Invalid preservation state: ${state}`);
  }

  const zoneState = {
    id: zoneStateId(accessionId, bone, side, zone),
    accessionId,
    bone,
    side,
    zone,
    state,
    updatedAt: new Date().toISOString(),
  };

  await withStore("zoneStates", "readwrite", (store) => requestToPromise(store.put(zoneState)));
  return zoneState;
}

export async function clearZoneState({ accessionId, bone, side = "", zone }) {
  const id = zoneStateId(accessionId, bone, side, zone);
  await withStore("zoneStates", "readwrite", (store) => requestToPromise(store.delete(id)));
}

export async function getZoneStatesByAccession(accessionId) {
  return withStore("zoneStates", "readonly", (store) =>
    requestToPromise(store.index("accessionId").getAll(accessionId))
  );
}
