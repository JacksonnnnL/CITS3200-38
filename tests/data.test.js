import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";

import {
  AGE_CATEGORIES,
  DuplicateSiteCodeError,
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

  it("rejects an invalid age category", async () => {
    const site = await createSite({ code: "WES001" });
    await expect(
      createAccession({ siteId: site.id, accessionNumber: "SK023", ageCategory: "teenager" })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("lists accessions scoped to their site", async () => {
    const siteA = await createSite({ code: "WES001" });
    const siteB = await createSite({ code: "WES002" });
    await createAccession({ siteId: siteA.id, accessionNumber: "SK001" });
    await createAccession({ siteId: siteB.id, accessionNumber: "SK002" });

    expect(await getAccessionsBySite(siteA.id)).toHaveLength(1);
    expect(await getAccessionsBySite(siteB.id)).toHaveLength(1);
  });

  it("updates an accession", async () => {
    const site = await createSite({ code: "WES001" });
    const accession = await createAccession({ siteId: site.id, accessionNumber: "SK023" });
    const updated = await updateAccession(accession.id, { notes: "found in situ" });
    expect(updated.notes).toBe("found in situ");
  });

  it("deleting an accession removes only its own zone states", async () => {
    const site = await createSite({ code: "WES001" });
    const a1 = await createAccession({ siteId: site.id, accessionNumber: "SK001" });
    const a2 = await createAccession({ siteId: site.id, accessionNumber: "SK002" });
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
    const accession = await createAccession({ siteId: site.id, accessionNumber: "SK023" });

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
    const accession = await createAccession({ siteId: site.id, accessionNumber: "SK023" });
    const coords = { accessionId: accession.id, bone: "FEM", side: "L", zone: "Z01" };

    await setZoneState({ ...coords, state: PRESERVATION_STATES.PRESENT_COMPLETE });
    await setZoneState({ ...coords, state: PRESERVATION_STATES.ABSENT });

    const states = await getZoneStatesByAccession(accession.id);
    expect(states).toHaveLength(1);
    expect(states[0].state).toBe(PRESERVATION_STATES.ABSENT);
  });

  it("rejects an invalid preservation state", async () => {
    const site = await createSite({ code: "WES001" });
    const accession = await createAccession({ siteId: site.id, accessionNumber: "SK023" });

    await expect(
      setZoneState({ accessionId: accession.id, bone: "FEM", zone: "Z01", state: "pathological" })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("clears a zone state", async () => {
    const site = await createSite({ code: "WES001" });
    const accession = await createAccession({ siteId: site.id, accessionNumber: "SK023" });
    const coords = { accessionId: accession.id, bone: "FEM", zone: "Z01" };

    await setZoneState({ ...coords, state: PRESERVATION_STATES.PRESENT_COMPLETE });
    await clearZoneState(coords);

    expect(await getZoneStatesByAccession(accession.id)).toHaveLength(0);
  });

  it("keeps zones distinct by bone/side/zone even on the same accession", async () => {
    const site = await createSite({ code: "WES001" });
    const accession = await createAccession({ siteId: site.id, accessionNumber: "SK023" });

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
