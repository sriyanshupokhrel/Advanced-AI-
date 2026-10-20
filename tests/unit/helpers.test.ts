import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { formatDateRange, formatFileSize, formatMonth, jobDisplayTitle } from "@/lib/cv/format";
import { safeReturnTo } from "@/lib/navigation";

describe("safeReturnTo (prevents open redirects)", () => {
  test("accepts review-page paths only", () => {
    assert.equal(safeReturnTo("/prepare/cmabc123"), "/prepare/cmabc123");
    assert.equal(safeReturnTo(["/prepare/a1", "/x"]), "/prepare/a1");
  });
  test("rejects everything else", () => {
    for (const value of ["https://evil.example.com", "//evil.example.com", "/prepare/../admin", "/cv/1", "/prepare/", undefined, "javascript:alert(1)"]) {
      assert.equal(safeReturnTo(value), undefined, String(value));
    }
  });
});

describe("formatting", () => {
  test("months and ranges", () => {
    assert.equal(formatMonth("2024-03"), "Mar 2024");
    assert.equal(formatDateRange("2021-03", "", true), "Mar 2021 – Present");
    assert.equal(formatDateRange("2021-03", "2022-01"), "Mar 2021 – Jan 2022");
    assert.equal(formatDateRange("", ""), "");
  });
  test("file sizes", () => {
    assert.equal(formatFileSize(512), "512 B");
    assert.equal(formatFileSize(5 * 1024 * 1024), "5.0 MB");
  });
  test("job titles tolerate missing fields", () => {
    assert.equal(jobDisplayTitle({ title: "", companyName: "" }), "Untitled job");
    assert.equal(jobDisplayTitle({ title: "Dev", companyName: "Co" }), "Dev — Co");
  });
});
