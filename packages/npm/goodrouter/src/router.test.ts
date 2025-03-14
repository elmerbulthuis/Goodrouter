import assert from "node:assert/strict";
import test from "node:test";
import { Router, RouterMode } from "./router.js";
import { parametersFromTemplates } from "./testing/parameters.js";
import { loadTemplates } from "./testing/templates.js";

test("router-readme", () => {
  const router = new Router();

  router.insertRoute("all-products", "/product/all");
  router.insertRoute("product-detail", "/product/{id}");

  // And now we can parse routes!

  {
    const [routeKey] = router.parseRoute("/not-found");
    assert.equal(routeKey, null);
  }

  {
    const [routeKey] = router.parseRoute("/product/all");
    assert.equal(routeKey, "all-products");
  }

  {
    const [routeKey, routeParameters] = router.parseRoute("/product/1");
    assert.equal(routeKey, "product-detail");
    assert.deepEqual(routeParameters, { id: "1" });
  }

  // And we can stringify routes

  {
    const path = router.stringifyRoute("all-products");
    assert.equal(path, "/product/all");
  }

  {
    const path = router.stringifyRoute("product-detail", { id: "2" });
    assert.equal(path, "/product/2");
  }
});

test("parse-route 1", () => {
  enum Route {
    A,
    B,
    C,
    D,
  }

  const router = new Router<Route>();

  router.insertRoute(Route.A, "/a");
  router.insertRoute(Route.B, "/b/{x}");
  router.insertRoute(Route.C, "/b/{x}/c");
  router.insertRoute(Route.D, "/b/{x}/d");

  {
    const [routeKey] = router.parseRoute("/a");
    assert.equal(routeKey, Route.A);
  }
  {
    const [routeKey] = router.parseRoute("/b/x");
    assert.equal(routeKey, Route.B);
  }
  {
    const [routeKey] = router.parseRoute("/b/y/c");
    assert.equal(routeKey, Route.C);
  }
  {
    const [routeKey] = router.parseRoute("/b/z/d");
    assert.equal(routeKey, Route.D);
  }
});

test("parse-route 2", () => {
  const router = new Router();

  router.insertRoute("aa", "a/{a}/a");
  router.insertRoute("a", "a");

  router.insertRoute("one", "/a");
  router.insertRoute("two", "/a/{x}/{y}");
  router.insertRoute("three", "/c/{x}");
  router.insertRoute("four", "/c/{x}/{y}/");

  {
    const [routeKey, routeParameters] = router.parseRoute("/a");
    assert.equal(routeKey, "one");
  }

  {
    const [routeKey, routeParameters] = router.parseRoute("/a/1/2");
    assert.equal(routeKey, "two");
    assert.deepEqual(routeParameters, { x: "1", y: "2" });
  }

  {
    const path = router.stringifyRoute("two", { x: "1", y: "2" });
    assert.equal(path, "/a/1/2");
  }

  {
    const [routeKey, routeParameters] = router.parseRoute("/c/3");
    assert.equal(routeKey, "three");
    assert.deepEqual(routeParameters, { x: "3" });
  }

  {
    const [routeKey, routeParameters] = router.parseRoute("/c/3/4");
    assert.equal(routeKey, "three");
    assert.deepEqual(routeParameters, { x: "3/4" });
  }

  {
    const path = router.stringifyRoute("three", { x: "3/4" });
    assert.equal(path, "/c/3%2F4");
  }

  {
    const [routeKey, routeParameters] = router.parseRoute("/c/3/4/");
    assert.equal(routeKey, "four");
    assert.deepEqual(routeParameters, { x: "3", y: "4" });
  }
});

test("router bug", () => {
  const router = new Router();

  router
    .insertRoute("a", "/enterprises/{enterprise}/actions/runner-groups")
    .insertRoute("b", "/enterprises/{enterprise}/actions/runner-groups/{runner_group_id}")
    .insertRoute(
      "c",
      "/enterprises/{enterprise}/actions/runner-groups/{runner_group_id}/organizations",
    );

  assert.deepEqual(router.parseRoute("/enterprises/xx/actions/runner-groups"), [
    "a",
    { enterprise: "xx" },
  ]);

  assert.deepEqual(router.parseRoute("/enterprises/xx/actions/runner-groups/yy"), [
    "b",
    { enterprise: "xx", runner_group_id: "yy" },
  ]);

  assert.deepEqual(router.parseRoute("/enterprises/xx/actions/runner-groups/yy/organizations"), [
    "c",
    { enterprise: "xx", runner_group_id: "yy" },
  ]);
});

test("router bug 2", () => {
  const router = new Router();

  router
    .insertRoute("a", "/api/v1/Spaces/{spaceId}/HeatmapZones/_/LatestData")
    .insertRoute("b", "/api/v1/Spaces/{spaceId}/HeatmapZones/{zoneId}/LatestData")
    .insertRoute("c", "/api/v1/Spaces/{spaceId}/HeatmapZones/_/SummedData");

  assert.deepEqual(
    router.parseRoute(
      "/api/v1/Spaces/7321b6ff-6b8a-4ced-91ca-fe7f7d021f8a/HeatmapZones/_/LatestData",
    ),
    ["a", { spaceId: "7321b6ff-6b8a-4ced-91ca-fe7f7d021f8a" }],
  );

  assert.deepEqual(
    router.parseRoute(
      "/api/v1/Spaces/7321b6ff-6b8a-4ced-91ca-fe7f7d021f8a/HeatmapZones/95516e21-a29c-472b-984f-5519664cd25d/LatestData",
    ),
    [
      "b",
      {
        spaceId: "7321b6ff-6b8a-4ced-91ca-fe7f7d021f8a",
        zoneId: "95516e21-a29c-472b-984f-5519664cd25d",
      },
    ],
  );
});

test("route-node-json", () => {
  const router = new Router();
  router.insertRoute(1, "x/y");
  router.insertRoute(2, "x/z");

  const templatePairs = [
    [1, [["x/y", null]]],
    [2, [["x/z", null]]],
  ];
  const rootNode = {
    anchor: "",
    hasParameter: false,
    routeKey: null,
    children: [
      {
        anchor: "x/",
        hasParameter: false,
        routeKey: null,
        children: [
          {
            anchor: "y",
            hasParameter: false,
            routeKey: 1,
            children: [],
          },
          {
            anchor: "z",
            hasParameter: false,
            routeKey: 2,
            children: [],
          },
        ],
      },
    ],
  };

  {
    const actual = router.saveToJson(RouterMode.Client);
    const expected = {
      rootNode: undefined,
      templatePairs,
    };
    assert.deepEqual(actual, expected);
  }

  {
    const actual = router.saveToJson(RouterMode.Server);
    const expected = {
      rootNode,
      templatePairs: undefined,
    };
    assert.deepEqual(actual, expected);
  }

  {
    const actual = router.saveToJson(RouterMode.Bidirectional);
    const expected = {
      rootNode,
      templatePairs,
    };
    assert.deepEqual(actual, expected);
  }
});

testTemplates("small");
testTemplates("docker");
testTemplates("github");

function testTemplates(name: string) {
  test(`${name} templates`, () => {
    const templates = loadTemplates(name);
    const allParameterNames = [...parametersFromTemplates(templates)];

    const allParameters = Object.fromEntries(
      allParameterNames.map((name, index) => [name, `p${index}`]),
    );

    const templateCount = templates.length;

    const router = new Router();
    for (const template of templates) {
      router.insertRoute(template, template);
    }

    const paths = templates.map((template) => {
      const path = router.stringifyRoute(template, allParameters);
      assert(path != null);
      return path;
    });

    for (let index = 0; index < templateCount; index++) {
      const path = paths[index];
      const template = templates[index];

      const [routeKey, routeParameters] = router.parseRoute(path);
      const expectedParameters = Object.fromEntries(
        Object.keys(routeParameters).map((name) => [name, allParameters[name]]),
      );

      assert.equal(routeKey, template);
      assert.deepEqual(routeParameters, expectedParameters);
    }
  });
}
