import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mapCategory,
  normalizeSize,
  splitBrandName,
  polishProposal,
  pluralizeUnit,
} from "../src/lib/proposal-polish.ts";

test("categories map to the allowed ones without laundering regulated goods", () => {
  assert.equal(mapCategory("toothpaste", "Cavity Fighter", "Close-Up"), "personal care");
  assert.equal(mapCategory("", "Medicated Soap", "Dettol"), "personal care");
  assert.equal(mapCategory("oral care", "Toothbrush", ""), "personal care");
  assert.equal(mapCategory("cleaning", "Washing Soap", ""), "household");
  assert.equal(mapCategory("", "Dishwashing Liquid", ""), "household");
  assert.equal(mapCategory("drinks", "Zobo", "Kubwa"), "provisions");
  assert.equal(mapCategory("dairy", "Milk", ""), "provisions");
  assert.equal(mapCategory("provisions", "Rice", ""), "provisions");
  assert.equal(mapCategory("medicines", "Paracetamol", ""), "medicines");
  assert.equal(mapCategory("electronics", "Torch", ""), "electronics");
  assert.equal(mapCategory("", "Torch Light", ""), "");
});

test("sizes normalize to compact metric forms", () => {
  assert.equal(normalizeSize("6.0 OZ (170 g)"), "170g");
  assert.equal(normalizeSize("6.0 OZ"), "170g");
  assert.equal(normalizeSize("70 G"), "70g");
  assert.equal(normalizeSize("70g"), "70g");
  assert.equal(normalizeSize("1.5 L"), "1.5L");
  assert.equal(normalizeSize("50cl"), "50cl");
  assert.equal(normalizeSize("1 lb"), "454g");
  assert.equal(normalizeSize("12 fl oz"), "355ml");
  assert.equal(normalizeSize(""), "");
  assert.equal(normalizeSize("Pack of 6"), "Pack of 6");
});

test("brand, short name and variant split without repetition", () => {
  assert.deepEqual(splitBrandName("Close-Up Toothpaste Red Hot", "Close-Up", "140g"), {
    name: "Toothpaste Red Hot", brand: "Close-Up", variant: "Standard", size: "140g",
  });
  assert.deepEqual(splitBrandName("Indomie Noodles (Chicken)", "Indomie", "70g"), {
    name: "Noodles", brand: "Indomie", variant: "Chicken", size: "70g",
  });
  assert.deepEqual(splitBrandName("Noodles - Chicken", "", "70g"), {
    name: "Noodles", brand: "", variant: "Chicken", size: "70g",
  });
  assert.deepEqual(splitBrandName("Zobo 50cl", "Kubwa", ""), {
    name: "Zobo", brand: "Kubwa", variant: "Standard", size: "50cl",
  });
  assert.deepEqual(splitBrandName("Coca-Cola", "Coca-Cola", "50cl"), {
    name: "Coca-Cola", brand: "Coca-Cola", variant: "Standard", size: "50cl",
  });
  assert.deepEqual(splitBrandName("ColgateTotal", "Colgate", "140g"), {
    name: "ColgateTotal", brand: "Colgate", variant: "Standard", size: "140g",
  });
});

test("a full proposal polishes end to end", () => {
  assert.deepEqual(
    polishProposal({ name: "Close-Up Toothpaste (Red Hot)", brand: "Close-Up", size: "6.0 OZ (170 g)", unit: "piece", category: "toothpaste" }),
    { name: "Toothpaste", brand: "Close-Up", variant: "Red Hot", size: "170g", unit: "piece", category: "personal care" },
  );
  assert.deepEqual(
    polishProposal({ name: null, brand: null, size: null, unit: null, category: null }),
    { name: "", brand: "", variant: "Standard", size: "", unit: null, category: "provisions" },
  );
});

test("units use singular and plural correctly", () => {
  assert.equal(pluralizeUnit("piece", 1), "piece");
  assert.equal(pluralizeUnit("piece", 2), "pieces");
  assert.equal(pluralizeUnit("pack", 0), "packs");
  assert.equal(pluralizeUnit("carton", 1), "carton");
  assert.equal(pluralizeUnit("bottle", 12), "bottles");
});
