import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("embeds the Applicant Reviewer tracker", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
  ]);
  assert.match(page, /src="\/tracker\.html"/);
  assert.match(page, /title="Applicant Reviewer"/);
  assert.match(layout, /title: "Applicant Reviewer"/);
});

test("keeps the tracker assets connected", async () => {
  const [html, script, styles] = await Promise.all([
    readFile(new URL("public/tracker.html", root), "utf8"),
    readFile(new URL("public/tracker.js", root), "utf8"),
    readFile(new URL("public/tracker.css", root), "utf8"),
  ]);
  assert.match(html, /Applicant Reviewer/);
  assert.match(html, /tracker\.js/);
  assert.match(script, /function loadCsv/);
  assert.match(styles, /theme-toggle/);
});
