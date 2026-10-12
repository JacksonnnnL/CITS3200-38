import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";

import {
  AGE_CATEGORIES,
  DuplicateAccessionNumberError,
  DuplicateSiteCodeError,
  NotFoundError,
  PRESERVATION_STATES,
  ValidationError,
  __resetConnectionForTests,
  clearZoneState,
  createAccession,
  createContext,
  createSite,
  deleteAccession,
  deleteSite,
  getAccessionById,
  getAccessionsBySite,
  getContextsBySite,
  getSiteByCode,
  getSites,
  getZoneStatesByAccession,
  setZoneState,
  updateAccession,
  updateSite,
} from "../www/js/data.js";

// Every test gets a brand-new, empty IndexedDB (fake-indexeddb) so tests
// can't see each other's data, and the module's cached connection is
// dropped so it reopens against the fresh instance.
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  __resetConnectionForTests();
});

describe("sites", () => {
  it("creates a site and retrieves it", async () => {
    const site = await createSite({ code: "WES001", description: "West Cemetery" });

    expect(site.code).toBe("WES001");
    const all = await getSites();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(site.id);
  });

  it("rejects a duplicate site code", async () => {
    await createSite({ code: "WES001" });
    await expect(createSite({ code: "WES001" })).rejects.toBeInstanceOf(DuplicateSiteCodeError);
  });

  it("rejects an empty site code", async () => {
    await expect(createSite({ code: "   " })).rejects.toBeInstanceOf(ValidationError);
  });

  it("finds a site by code", async () => {
    await createSite({ code: "WES001" });
    const found = await getSiteByCode("WES001");
    expect(found).toBeTruthy();
    expect(found.code).toBe("WES001");
    expect(await getSiteByCode("NOPE")).toBeUndefined();
  });

  it("updates a site", async () => {
    const site = await createSite({ code: "WES001", description: "old" });
    const updated = await updateSite(site.id, { description: "new" });
    expect(updated.description).toBe("new");
    expect(updated.code).toBe("WES001");
  });

  it("deletes a site and cascades to its contexts, accessions, and zone states", async () => {
    const site = await createSite({ code: "WES001" });
    const context = await createContext({ siteId: site.id, code: "C105" });
    const accession = await createAccession({
      siteId: site.id,
      contextId: context.id,
      accessionNumber: "SK023",
      ageCategory: AGE_CATEGORIES.ADULT,
    });
    await setZoneState({
      accessionId: accession.id,
      bone: "FEM",
      side: "L",
      zone: "Z01",
      state: PRESERVATION_STATES.PRESENT_COMPLETE,
    });

    await deleteSite(site.id);

    expect(await getSites()).toHaveLength(0);
    expect(await getContextsBySite(site.id)).toHaveLength(0);
    expect(await getAccessionsBySite(site.id)).toHaveLength(0);
    expect(await getZoneStatesByAccession(accession.id)).toHaveLength(0);
  });
});

describe("contexts", () => {
  it("creates a context under a site and lists it", async () => {
    const site = await createSite({ code: "WES001" });
    await createContext({ siteId: site.id, code: "C105", notes: "grave 5" });

    const contexts = await getContextsBySite(site.id);
    expect(contexts).toHaveLength(1);
    expect(contexts[0].code).toBe("C105");
  });

  it("requires a siteId and a code", async () => {
    await expect(createContext({ siteId: null, code: "C105" })).rejects.toBeInstanceOf(
      ValidationError
    );
    const site = await createSite({ code: "WES001" });
    await expect(createContext({ siteId: site.id, code: "" })).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it("rejects a context whose siteId does not reference a real site", async () => {
    await expect(
      createContext({ siteId: "does-not-exist", code: "C105" })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("accessions", () => {
  it("creates an accession without requiring a context (context is optional)", async () => {
    const site = await createSite({ code: "WES001" });
    const accession = await createAccession({
      siteId: site.id,
      accessionNumber: "SK023",
      ageCategory: AGE_CATEGORIES.ADULT,
    });

    expect(accession.contextId).toBeNull();
    const fetched = await getAccessionById(accession.id);
    expect(fetched.accessionNumber).toBe("SK023");
  });

  it("rejects duplicate accession numbers within the same site, ignoring case and whitespace", async () => {
    const site = await createSite({ code: "WES001" });
    await createAccession({ siteId: site.id, accessionNumber: "SK023", ageCategory: AGE_CATEGORIES.ADULT });

    await expect(createAccession({
      siteId: site.id,
      accessionNumber: " sk023 ",
      ageCategory: AGE_CATEGORIES.CHILD,
    })).rejects.toBeInstanceOf(DuplicateAccessionNumberError);

    expect(await getAccessionsBySite(site.id)).toHaveLength(1);
  });

  it("rejects duplicates across contexts within the same site", async () => {
    const site = await createSite({ code: "WES001" });
    const contextA = await createContext({ siteId: site.id, code: "G1" });
    const contextB = await createContext({ siteId: site.id, code: "G2" });
    await createAccession({ siteId: site.id, contextId: contextA.id, accessionNumber: "SK023", ageCategory: AGE_CATEGORIES.ADULT });

    await expect(createAccession({
      siteId: site.id, contextId: contextB.id, accessionNumber: "SK023", ageCategory: AGE_CATEGORIES.INFANT,
    })).rejects.toBeInstanceOf(DuplicateAccessionNumberError);
  });

  it("allows the same accession number in different sites", async () => {
    const siteA = await createSite({ code: "WES001" });
    const siteB = await createSite({ code: "WES002" });
    await createAccession({ siteId: siteA.id, accessionNumber: "SK023", ageCategory: AGE_CATEGORIES.ADULT });
    await createAccession({ siteId: siteB.id, accessionNumber: "sk023", ageCategory: AGE_CATEGORIES.CHILD });

    expect(await getAccessionsBySite(siteA.id)).toHaveLength(1);
    expect(await getAccessionsBySite(siteB.id)).toHaveLength(1);
  });

  it("rejects a duplicate on renaming an accession, but permits an unchanged number", async () => {
    const site = await createSite({ code: "WES001" });
    const first = await createAccession({ siteId: site.id, accessionNumber: "SK001", ageCategory: AGE_CATEGORIES.ADULT });
    const second = await createAccession({ siteId: site.id, accessionNumber: "SK002", ageCategory: AGE_CATEGORIES.ADULT });

    await expect(updateAccession(second.id, { accessionNumber: " sk001 " }))
      .rejects.toBeInstanceOf(DuplicateAccessionNumberError);
    expect((await getAccessionById(second.id)).accessionNumber).toBe("SK002");
    expect((await updateAccession(first.id, { accessionNumber: "sk001" })).accessionNumber).toBe("sk001");
  });

  it("serializes concurrent duplicate creations", async () => {
    const site = await createSite({ code: "WES001" });
    const results = await Promise.allSettled([
      createAccession({ siteId: site.id, accessionNumber: "SK023", ageCategory: AGE_CATEGORIES.ADULT }),
      createAccession({ siteId: site.id, accessionNumber: "sk023", ageCategory: AGE_CATEGORIES.CHILD }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await getAccessionsBySite(site.id)).toHaveLength(1);
  });

  it("requires a developmental age before creating an individual", async () => {
    const site = await createSite({ code: "WES001" });

    for (const ageCategory of [undefined, null, ""]) {
      await expect(
        createAccession({ siteId: site.id, accessionNumber: "SK023", ageCategory })
      ).rejects.toThrow("Developmental age is required");
    }

    expect(await getAccessionsBySite(site.id)).toHaveLength(0);
  });

  it("rejects an invalid age category", async () => {
    const site = await createSite({ code: "WES001" });
    await expect(
      createAccession({ siteId: site.id, accessionNumber: "SK023", ageCategory: "teenager" })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects an accession whose siteId does not reference a real site", async () => {
    await expect(
      createAccession({ siteId: "does-not-exist", accessionNumber: "SK023", ageCategory: AGE_CATEGORIES.ADULT })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects an accession whose contextId does not reference a real context", async () => {
    const site = await createSite({ code: "WES001" });
    await expect(
      createAccession({
        siteId: site.id,
        contextId: "does-not-exist",
        accessionNumber: "SK023",
        ageCategory: AGE_CATEGORIES.ADULT,
      })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects an accession whose contextId belongs to a different site", async () => {
    const siteA = await createSite({ code: "WES001" });
    const siteB = await createSite({ code: "WES002" });
    const contextOnB = await createContext({ siteId: siteB.id, code: "C1" });

    await expect(
      createAccession({
        siteId: siteA.id,
        contextId: contextOnB.id,
        accessionNumber: "SK023",
        ageCategory: AGE_CATEGORIES.ADULT,
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("lists accessions scoped to their site", async () => {
    const siteA = await createSite({ code: "WES001" });
    const siteB = await createSite({ code: "WES002" });
    await createAccession({ siteId: siteA.id, accessionNumber: "SK001", ageCategory: AGE_CATEGORIES.ADULT });
    await createAccession({ siteId: siteB.id, accessionNumber: "SK002", ageCategory: AGE_CATEGORIES.ADULT });

    expect(await getAccessionsBySite(siteA.id)).toHaveLength(1);
    expect(await getAccessionsBySite(siteB.id)).toHaveLength(1);
  });

  it("updates an accession", async () => {
    const site = await createSite({ code: "WES001" });
    const accession = await createAccession({ siteId: site.id, accessionNumber: "SK023", ageCategory: AGE_CATEGORIES.ADULT });
    const updated = await updateAccession(accession.id, { notes: "found in situ" });
    expect(updated.notes).toBe("found in situ");
  });

  it("deleting an accession removes only its own zone states", async () => {
    const site = await createSite({ code: "WES001" });
    const a1 = await createAccession({ siteId: site.id, accessionNumber: "SK001", ageCategory: AGE_CATEGORIES.ADULT });
    const a2 = await createAccession({ siteId: site.id, accessionNumber: "SK002", ageCategory: AGE_CATEGORIES.ADULT });
    await setZoneState({
      accessionId: a1.id,
      bone: "FEM",
      zone: "Z01",
      state: PRESERVATION_STATES.ABSENT,
    });
    await setZoneState({
      accessionId: a2.id,
      bone: "FEM",
      zone: "Z01",
      state: PRESERVATION_STATES.ABSENT,
    });

    await deleteAccession(a1.id);

    expect(await getZoneStatesByAccession(a1.id)).toHaveLength(0);
    expect(await getZoneStatesByAccession(a2.id)).toHaveLength(1);
  });
});

describe("zone states", () => {
  it("sets a zone state and reads it back", async () => {
    const site = await createSite({ code: "WES001" });
    const accession = await createAccession({ siteId: site.id, accessionNumber: "SK023", ageCategory: AGE_CATEGORIES.ADULT });

    await setZoneState({
      accessionId: accession.id,
      bone: "FEM",
      side: "L",
      zone: "Z01",
      state: PRESERVATION_STATES.PRESENT_FRAGMENTED,
    });

    const states = await getZoneStatesByAccession(accession.id);
    expect(states).toHaveLength(1);
    expect(states[0].state).toBe(PRESERVATION_STATES.PRESENT_FRAGMENTED);
  });

  it("setting the same zone twice upserts instead of duplicating", async () => {
    const site = await createSite({ code: "WES001" });
    const accession = await createAccession({ siteId: site.id, accessionNumber: "SK023", ageCategory: AGE_CATEGORIES.ADULT });
    const coords = { accessionId: accession.id, bone: "FEM", side: "L", zone: "Z01" };

    await setZoneState({ ...coords, state: PRESERVATION_STATES.PRESENT_COMPLETE });
    await setZoneState({ ...coords, state: PRESERVATION_STATES.ABSENT });

    const states = await getZoneStatesByAccession(accession.id);
    expect(states).toHaveLength(1);
    expect(states[0].state).toBe(PRESERVATION_STATES.ABSENT);
  });

  it("rejects an invalid preservation state", async () => {
    const site = await createSite({ code: "WES001" });
    const accession = await createAccession({ siteId: site.id, accessionNumber: "SK023", ageCategory: AGE_CATEGORIES.ADULT });

    await expect(
      setZoneState({ accessionId: accession.id, bone: "FEM", zone: "Z01", state: "pathological" })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a zone state whose accessionId does not reference a real accession", async () => {
    await expect(
      setZoneState({
        accessionId: "does-not-exist",
        bone: "FEM",
        zone: "Z01",
        state: PRESERVATION_STATES.ABSENT,
      })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("clears a zone state", async () => {
    const site = await createSite({ code: "WES001" });
    const accession = await createAccession({ siteId: site.id, accessionNumber: "SK023", ageCategory: AGE_CATEGORIES.ADULT });
    const coords = { accessionId: accession.id, bone: "FEM", zone: "Z01" };

    await setZoneState({ ...coords, state: PRESERVATION_STATES.PRESENT_COMPLETE });
    await clearZoneState(coords);

    expect(await getZoneStatesByAccession(accession.id)).toHaveLength(0);
  });

  it("keeps zones distinct by bone/side/zone even on the same accession", async () => {
    const site = await createSite({ code: "WES001" });
    const accession = await createAccession({ siteId: site.id, accessionNumber: "SK023", ageCategory: AGE_CATEGORIES.ADULT });

    await setZoneState({
      accessionId: accession.id,
      bone: "FEM",
      side: "L",
      zone: "Z01",
      state: PRESERVATION_STATES.PRESENT_COMPLETE,
    });
    await setZoneState({
      accessionId: accession.id,
      bone: "FEM",
      side: "R",
      zone: "Z01",
      state: PRESERVATION_STATES.ABSENT,
    });

    const states = await getZoneStatesByAccession(accession.id);
    expect(states).toHaveLength(2);
  });
});

describe("id generation fallback", () => {
  // crypto.randomUUID() is undefined outside a secure context (plain HTTP,
  // file://, some WebViews) — this simulates that by stubbing out the
  // global crypto object, the same way it's genuinely missing in the field.
  // globalThis.crypto is a getter-only property in Node, so plain
  // assignment (globalThis.crypto = ...) throws; vi.stubGlobal is built
  // for exactly this.
  const originalCrypto = globalThis.crypto;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("still creates records when crypto.randomUUID is unavailable", async () => {
    vi.stubGlobal("crypto", {
      getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
    });

    const site = await createSite({ code: "WES001" });
    expect(site.id).toBeTruthy();
    expect(typeof site.id).toBe("string");

    const again = await createSite({ code: "WES002" });
    expect(again.id).not.toBe(site.id);
  });

  it("still creates records when crypto is unavailable at all", async () => {
    vi.stubGlobal("crypto", undefined);

    const site = await createSite({ code: "WES001" });
    expect(site.id).toBeTruthy();

    const again = await createSite({ code: "WES002" });
    expect(again.id).not.toBe(site.id);
  });
});
