import { describe, expect, it } from "vitest";
import { isAcyclic, topoSort, prerequisitesOf, dependentsOf } from "../lib/graph";

describe("graph utilities", () => {
  it("detects an acyclic graph", () => {
    expect(
      isAcyclic(["a", "b", "c"], [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
      ]),
    ).toBe(true);
  });

  it("detects a cycle a->b->c->a", () => {
    expect(
      isAcyclic(["a", "b", "c"], [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
        { from: "c", to: "a" },
      ]),
    ).toBe(false);
  });

  it("returns null from topoSort on a cycle", () => {
    expect(
      topoSort(["a", "b"], [{ from: "a", to: "b" }, { from: "b", to: "a" }]),
    ).toBeNull();
  });

  it("topo sorts a diamond respecting dependencies", () => {
    // diamond: a -> b, a -> c, b -> d, c -> d
    const order = topoSort(["a", "b", "c", "d"], [
      { from: "a", to: "b" },
      { from: "a", to: "c" },
      { from: "b", to: "d" },
      { from: "c", to: "d" },
    ]);
    expect(order).toEqual(["a", "b", "c", "d"]);
  });

  it("computes prerequisites and dependents", () => {
    const edges = [
      { from: "a", to: "b" },
      { from: "c", to: "b" },
    ];
    expect(prerequisitesOf("b", edges)).toEqual(["a", "c"]);
    expect(dependentsOf("a", edges)).toEqual(["b"]);
  });
});
