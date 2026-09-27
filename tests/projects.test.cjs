const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "isolated-project-test-secret";
process.env.R2_ACCOUNT_ID ??= "test-account";
process.env.R2_ACCESS_KEY_ID ??= "test-access-key";
process.env.R2_SECRET_ACCESS_KEY ??= "test-secret-key";
process.env.R2_BUCKET_NAME ??= "test-bucket";
process.env.R2_PUBLIC_URL ??= "https://images.example.test";

const prisma = require("../dist/database/prisma.js").default;
const router =
  require("../dist/modules/project/routes/project.routes.js").default;
const uploadRouter =
  require("../dist/modules/project/routes/upload.routes.js").default;

test("project categories and metadata persist through protected CRUD", async () => {
  const records = new Map();
  const matches = (item, where = {}) =>
    Object.entries(where).every(([key, value]) => {
      if (key === "id" && typeof value === "object" && value !== null) {
        return item.id !== value.not;
      }
      return item[key] === value;
    });

  prisma.project.findMany = async ({ where = {}, select } = {}) => {
    const found = [...records.values()]
      .filter((item) => matches(item, where))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    return found.map((item) => (select ? { id: item.id } : { ...item }));
  };
  prisma.project.findFirst = async ({ where }) =>
    [...records.values()].find((item) => matches(item, where)) ?? null;
  prisma.project.aggregate = async ({ where }) => {
    const active = [...records.values()].filter((item) => matches(item, where));
    return {
      _max: {
        sortOrder: active.length
          ? Math.max(...active.map((item) => item.sortOrder))
          : null,
      },
    };
  };
  prisma.project.create = async ({ data }) => {
    const item = {
      id: String(records.size + 1),
      published: true,
      featured: false,
      category: "web",
      status: "completed",
      stack: [],
      highlights: [],
      images: [],
      sortOrder: records.size,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };
    records.set(item.id, item);
    return { ...item };
  };
  prisma.project.update = async ({ where, data }) => {
    const current = records.get(where.id);
    if (!current) {
      const error = new Error("Record not found.");
      error.code = "P2025";
      throw error;
    }
    const item = { ...current, ...data, updatedAt: new Date() };
    records.set(item.id, item);
    return { ...item };
  };
  prisma.project.delete = async ({ where }) => {
    const item = records.get(where.id);
    records.delete(where.id);
    return item;
  };

  const app = express();
  app.use(express.json());
  app.use("/api", router);
  app.use("/api/projects", uploadRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${jwt.sign({ userId: "admin", role: "admin" }, process.env.JWT_SECRET)}`,
  };
  const send = (path, method, body) =>
    fetch(base + path, { method, headers, body: JSON.stringify(body) });

  try {
    assert.equal((await fetch(`${base}/admin/projects`)).status, 401);
    assert.equal(
      (await fetch(`${base}/projects/upload`, { method: "POST" })).status,
      401,
    );
    assert.equal(
      (
        await fetch(`${base}/projects/upload`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${jwt.sign({ userId: "admin", role: "admin" }, process.env.JWT_SECRET)}`
          },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await send("/projects", "POST", {
          title: "Invalid category",
          role: "Network engineer",
          description: "Test project",
          category: "spaceship",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await send("/projects", "POST", {
          title: "Bad topology image",
          role: "Network engineer",
          description: "Test project",
          category: "networking",
          images: ["javascript:alert(1)"],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await send("/projects", "POST", {
          title: "Invalid contribution",
          role: "Developer",
          description: "Test project",
          contributions: [
            { kind: "reviewed", title: "Frontend" },
          ],
        })
      ).status,
      400,
    );

    const createResponse = await send("/projects", "POST", {
      title: "Multi-Branch Office Network",
      role: "Network designer",
      description: "A segmented multi-site network.",
      fullDescription: "Configured and tested branch connectivity.",
      category: "networking",
      stack: ["Cisco Packet Tracer", "VLAN", "OSPF", "DHCP", "ACL"],
      highlights: ["Inter-VLAN routing", "Static and dynamic routes"],
      contributions: [
        {
          kind: "built",
          title: "VLAN segmentation",
          details: "Configured separate networks for staff and guests.",
        },
        {
          kind: "team",
          title: "Requirements gathering",
        },
      ],
      coverImageUrl: "https://images.example.test/topology.png",
      images: ["https://images.example.test/switches.png"],
      status: "completed",
      sourceUrl: "https://github.com/example/network-project",
      liveUrl: "",
      featured: true,
      published: true,
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.equal(created.slug, "multi-branch-office-network");
    assert.equal(created.sortOrder, 0);
    assert.equal(created.category, "networking");
    assert.equal(
      created.coverImageUrl,
      "https://images.example.test/topology.png",
    );
    assert.deepEqual(created.stack, [
      "Cisco Packet Tracer",
      "VLAN",
      "OSPF",
      "DHCP",
      "ACL",
    ]);
    assert.deepEqual(created.contributions, [
      {
        kind: "built",
        title: "VLAN segmentation",
        details: "Configured separate networks for staff and guests.",
      },
      { kind: "team", title: "Requirements gathering" },
    ]);
    assert.equal(created.featured, true);
    assert.equal(
      (
        await send("/projects", "POST", {
          title: "Duplicate project slug",
          slug: created.slug,
          role: "Developer",
          description: "This slug is already in use.",
        })
      ).status,
      409,
    );

    const updateResponse = await send(`/projects/${created.id}`, "PATCH", {
      title: "Regional Office Network",
      category: "mobile",
      status: "in-progress",
      stack: ["Flutter", "Dart"],
      contributions: [
        {
          kind: "supported",
          title: "Mobile app testing",
          details: "Helped test key flows across devices.",
        },
      ],
    });
    assert.equal(updateResponse.status, 200);
    const updated = await updateResponse.json();
    assert.equal(updated.category, "mobile");
    assert.equal(updated.slug, created.slug);
    assert.equal(updated.status, "in-progress");
    assert.deepEqual(updated.stack, ["Flutter", "Dart"]);
    assert.deepEqual(updated.contributions, [
      {
        kind: "supported",
        title: "Mobile app testing",
        details: "Helped test key flows across devices.",
      },
    ]);

    const publicProjects = await (await fetch(`${base}/projects`)).json();
    assert.equal(publicProjects.length, 1);
    assert.equal(publicProjects[0].category, "mobile");
    assert.deepEqual(publicProjects[0].contributions, updated.contributions);
    assert.equal(
      publicProjects[0].fullDescription,
      "Configured and tested branch connectivity.",
    );

    assert.equal(
      (
        await send(`/projects/${created.id}`, "PATCH", {
          category: "Not a category",
        })
      ).status,
      400,
    );
    assert.equal((await send(`/projects/${created.id}`, "DELETE")).status, 204);
    assert.deepEqual(await (await fetch(`${base}/projects`)).json(), []);
    assert.equal(
      (await send(`/projects/${created.id}/restore`, "POST", {})).status,
      200,
    );
    assert.equal((await fetch(`${base}/projects`)).status, 200);
    assert.equal(
      (await send(`/projects/${created.id}/permanent`, "DELETE")).status,
      204,
    );
    assert.equal(records.size, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
});
