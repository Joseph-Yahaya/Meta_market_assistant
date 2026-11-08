import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateCustomProduct,
  checkCustomFlags,
  findClosestProducts,
  CUSTOM_PRODUCT_LIMIT_PER_DAY,
} from "../src/lib/custom-products.ts";
import { verifyOperatorCode } from "../src/lib/operator.ts";
import { catalogWords } from "../src/lib/catalog-match.ts";
import { mergeProposals } from "../src/lib/custom-products.ts";

test("custom products validate lengths, units and regulated goods", () => {
  assert.deepEqual(validateCustomProduct({ name: "Zobo", brand: "Kubwa", size: "50cl", unit: "bottle", category: "provisions" }), {
    name: "Zobo", brand: "Kubwa", size: "50cl", unit: "bottle", category: "provisions",
  });
  assert.equal(CUSTOM_PRODUCT_LIMIT_PER_DAY, 10);
  assert.equal(
    validateCustomProduct({ name: "Zobo", brand: "", size: "50cl", unit: "bottle", category: "provisions" }).brand,
    "Unbranded",
  );
  for (const [input, code] of [
    [{ name: "x", brand: "", size: "1", unit: "piece", category: "provisions" }, /INVALID_PRODUCT_NAME/],
    [{ name: "ok name", brand: "", size: "1", unit: "sachet", category: "provisions" }, /INVALID_PRODUCT_UNIT/],
    [{ name: "ok name", brand: "", size: "", unit: "piece", category: "provisions" }, /INVALID_PRODUCT_SIZE/],
    [{ name: "Paracetamol", brand: "", size: "20", unit: "pack", category: "provisions" }, /REGULATED_PRODUCT/],
    [{ name: "Cough relief", brand: "", size: "100ml", unit: "bottle", category: "medicines" }, /REGULATED_PRODUCT/],
    [{ name: "Malaria drugs", brand: "", size: "20", unit: "pack", category: "provisions" }, /REGULATED_PRODUCT/],
  ])
    assert.throws(() => validateCustomProduct(input), code);
  assert.doesNotThrow(() =>
    validateCustomProduct({ name: "Drug-free cleaner", brand: "", size: "1L", unit: "bottle", category: "household" }),
  );
});

test("duplicates refuse and near matches flag for review", () => {
  const catalog = [
    { name: "Noodles", brand: "Indomie", size: "70g" },
    { name: "Sugar", brand: "Dangote", size: "1kg" },
  ];
  assert.deepEqual(
    checkCustomFlags({ name: "noodles", brand: "indomie", size: "70g", unit: "pack", category: "provisions" }, catalog).duplicate,
    true,
  );
  assert.deepEqual(
    checkCustomFlags({ name: "Noodles chicken", brand: "Indomie", size: "70g", unit: "pack", category: "provisions" }, catalog).flags,
    ["possible-duplicate"],
  );
  assert.deepEqual(
    checkCustomFlags({ name: "Zobo", brand: "Kubwa", size: "50cl", unit: "bottle", category: "drinks" }, catalog).flags,
    ["category-review"],
  );
  assert.deepEqual(
    checkCustomFlags({ name: "Zobo", brand: "Kubwa", size: "50cl", unit: "bottle", category: "provisions" }, catalog),
    { duplicate: false, flags: [] },
  );
});

test("closest products rank by shared words for the duplicate question", () => {
  const catalog = [
    { name: "Noodles", brand: "Indomie", size: "70g" },
    { name: "Noodles", brand: "Indomie", size: "120g" },
    { name: "Sugar", brand: "Dangote", size: "1kg" },
  ];
  const closest = findClosestProducts(catalogWords("indomie noodles 70g"), catalog);
  assert.equal(closest.length, 2);
  assert.equal(closest[0].size, "70g");
  assert.deepEqual(findClosestProducts(catalogWords("please"), catalog), []);
});

test("a back-label photo only fills gaps in the primary proposal", () => {
  const primary = { name: "Zobo", brand: null, size: "50cl", unit: "bottle", category: null, notes: null };
  const back = { name: "Wrong", brand: "Kubwa", size: "75cl", unit: "pack", category: "provisions", notes: "label" };
  assert.deepEqual(mergeProposals(primary, back), {
    name: "Zobo", brand: "Kubwa", size: "50cl", unit: "bottle", category: "provisions", notes: "label",
  });
});
test("operator review is gated by the access code", () => {
  const previous = process.env.DEMO_ACCESS_CODE;
  try {
    process.env.DEMO_ACCESS_CODE = "operator-code-1";
    assert.equal(verifyOperatorCode("operator-code-1"), true);
    assert.equal(verifyOperatorCode("wrong-code"), false);
    assert.equal(verifyOperatorCode(""), false);
    assert.equal(verifyOperatorCode(null), false);
    delete process.env.DEMO_ACCESS_CODE;
    assert.equal(verifyOperatorCode("operator-code-1"), false);
  } finally {
    if (previous === undefined) delete process.env.DEMO_ACCESS_CODE;
    else process.env.DEMO_ACCESS_CODE = previous;
  }
});
