import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { Task } from "./types";
import { readPrunedForest, appendPrunedForest, listPrunedIds } from "./pruned";

function task(id: number, overrides: Partial<Task> = {}): Task {
  return { id, title: `Task ${id}`, completed: false, children: [], ...overrides };
}

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pt-pruned-"));
}

describe("listPrunedIds", () => {
  it("returns empty set when subdir missing", () => {
    expect(listPrunedIds(tmpDir())).toEqual(new Set());
  });

  it("returns ids parsed from <id>.json files", () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, "pruned"));
    fs.writeFileSync(path.join(dir, "pruned", "5.json"), "[]");
    fs.writeFileSync(path.join(dir, "pruned", "12.json"), "[]");
    fs.writeFileSync(path.join(dir, "pruned", "ignore-me.txt"), "");
    expect(listPrunedIds(dir)).toEqual(new Set([5, 12]));
  });
});

describe("readPrunedForest", () => {
  it("returns null when file missing", () => {
    expect(readPrunedForest(tmpDir(), 5)).toBeNull();
  });

  it("returns the parsed Task[] when file exists", () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, "pruned"));
    const forest = [task(7, { title: "Seven" }), task(8)];
    fs.writeFileSync(path.join(dir, "pruned", "5.json"), JSON.stringify(forest));
    expect(readPrunedForest(dir, 5)).toEqual(forest);
  });
});

describe("appendPrunedForest", () => {
  let dir: string;
  beforeEach(() => { dir = tmpDir(); });

  it("creates the subdir lazily on first write", () => {
    appendPrunedForest(dir, 5, [task(7)]);
    expect(fs.existsSync(path.join(dir, "pruned", "5.json"))).toBe(true);
  });

  it("accumulates across calls under the same parent", () => {
    appendPrunedForest(dir, 5, [task(7)]);
    appendPrunedForest(dir, 5, [task(8), task(9)]);
    const forest = readPrunedForest(dir, 5)!;
    expect(forest.map(t => t.id)).toEqual([7, 8, 9]);
  });

  it("does nothing when subtrees is empty", () => {
    appendPrunedForest(dir, 5, []);
    expect(fs.existsSync(path.join(dir, "pruned"))).toBe(false);
  });
});
