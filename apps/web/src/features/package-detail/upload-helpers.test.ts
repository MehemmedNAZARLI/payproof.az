import { describe, expect, test } from "vitest";
import { samplesFor, stageOf } from "./upload-helpers";

describe("samplesFor (mock demo files)", () => {
  test("INV-1042 invoice samples, flagging the one already in the package", () => {
    const list = samplesFor("INV-1042", "invoice", ["INV-1042.pdf"]);
    expect(list.map((s) => s.file_name)).toEqual(["INV-1042_v2_PO-381.pdf", "INV-1042.pdf"]);
    expect(list.find((s) => s.file_name === "INV-1042.pdf")?.duplicate).toBe(true);
    expect(list.find((s) => s.file_name === "INV-1042_v2_PO-381.pdf")?.duplicate).toBe(false);
  });

  test("delivery samples are separate; other packages have none", () => {
    expect(samplesFor("INV-1042", "delivery", []).map((s) => s.file_name)).toEqual([
      "TS-5531_imzali.pdf",
    ]);
    expect(samplesFor("INV-1031", "invoice", [])).toEqual([]);
  });
});

test("stageOf: accepted → processing → extracted → checked", () => {
  expect(stageOf({ accepted: false })).toBe(-1);
  expect(stageOf({ accepted: true })).toBe(0);
  expect(stageOf({ accepted: true, job: "RUNNING" })).toBe(1);
  expect(stageOf({ accepted: true, job: "SUCCEEDED" })).toBe(2);
  expect(stageOf({ accepted: true, job: "SUCCEEDED", checked: true })).toBe(3);
});
