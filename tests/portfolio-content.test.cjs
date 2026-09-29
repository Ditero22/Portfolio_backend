const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const prisma = require("../dist/database/prisma.js").default;
const router =
  require("../dist/modules/portfolioContent/routes/portfolioContent.routes.js").default;

test("portfolio content stays private until published and can be managed by admin", async () => {
  process.env.JWT_SECRET = "isolated-content-test-secret";
  const entries = new Map();
  prisma.portfolioContent.findMany = async ({ where }) =>
    [...entries.values()].filter(
      (entry) =>
        (!where.kind || entry.kind === where.kind) &&
        (where.published === undefined || entry.published === where.published),
    );
  prisma.portfolioContent.aggregate = async () => ({
    _max: {
      sortOrder: Math.max(
        -1,
        ...[...entries.values()].map((entry) => entry.sortOrder),
      ),
    },
  });
  prisma.portfolioContent.create = async ({ data }) => {
    const ids = {
      RESOURCE: "test-resource",
      CERTIFICATION: "test-certification",
      SKILL: "test-skill",
    };
    const id = ids[data.kind] ?? `test-${data.kind.toLowerCase()}`;
    const entry = { id, ...data };
    entries.set(entry.id, entry);
    return entry;
  };
  prisma.portfolioContent.findFirst = async ({ where }) =>
    [...entries.values()].find(
      (entry) => entry.id === where.id && entry.kind === where.kind,
    ) ?? null;
  prisma.portfolioContent.update = async ({ where, data }) => {
    const entry = { ...entries.get(where.id), ...data };
    entries.set(entry.id, entry);
    return entry;
  };

  const app = express();
  app.use(express.json());
  app.use("/api", router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = jwt.sign(
    { userId: "admin", role: "admin" },
    process.env.JWT_SECRET,
  );
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  try {
    assert.equal(
      (
        await fetch(`${base}/skills`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "React", published: true }),
        })
      ).status,
      401,
    );

    const created = await fetch(`${base}/skills`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "React",
        subtitle: "Comfortable",
        description: "Building interactive interfaces.",
        category: "Frontend",
        url: null,
        published: false,
      }),
    });
    assert.equal(created.status, 201);
    assert.deepEqual(await (await fetch(`${base}/skills`)).json(), []);

    const adminEntries = await (
      await fetch(`${base}/admin/skills`, { headers })
    ).json();
    assert.equal(adminEntries.length, 1);
    assert.equal(adminEntries[0].category, "Frontend");

    const published = await fetch(`${base}/skills/test-skill`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ published: true }),
    });
    assert.equal(published.status, 200);
    assert.equal((await published.json()).title, "React");
    const publicSkills = await (await fetch(`${base}/skills`)).json();
    assert.equal(publicSkills.length, 1);
    assert.equal(
      publicSkills[0].description,
      "Building interactive interfaces.",
    );

    const missingLink = await fetch(`${base}/resources`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "UI inspiration",
        published: true,
      }),
    });
    assert.equal(missingLink.status, 400);

    const createdResource = await fetch(`${base}/resources`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "UI inspiration",
        subtitle: "Finding interface design inspiration",
        description: "A reference for visual ideas I can apply to my projects.",
        category: "UI design",
        url: "https://example.com/ui-inspiration",
        published: false,
      }),
    });
    assert.equal(createdResource.status, 201);
    assert.equal((await createdResource.json()).kind, "RESOURCE");
    assert.deepEqual(await (await fetch(`${base}/resources`)).json(), []);

    const adminResources = await (
      await fetch(`${base}/admin/resources`, { headers })
    ).json();
    assert.equal(adminResources.length, 1);
    assert.equal(adminResources[0].subtitle, "Finding interface design inspiration");

    const publishResource = await fetch(
      `${base}/resources/test-resource`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ published: true }),
      },
    );
    assert.equal(publishResource.status, 200);
    const publicResources = await (await fetch(`${base}/resources`)).json();
    assert.equal(
      publicResources[0].url,
      "https://example.com/ui-inspiration",
    );

    const certification = await fetch(`${base}/certifications`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "Network Fundamentals",
        subtitle: "Cisco",
        imageUrl: "https://cdn.example.com/certificates/network.png",
        published: true,
      }),
    });
    assert.equal(certification.status, 201);
    assert.equal(
      (await certification.json()).imageUrl,
      "https://cdn.example.com/certificates/network.png",
    );
    const publicCertifications = await (
      await fetch(`${base}/certifications`)
    ).json();
    assert.equal(
      publicCertifications[0].imageUrl,
      "https://cdn.example.com/certificates/network.png",
    );

    const invalidCertificationImage = await fetch(
      `${base}/certifications`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: "Invalid image",
          imageUrl: "javascript:alert(1)",
          published: false,
        }),
      },
    );
    assert.equal(invalidCertificationImage.status, 400);

    const imageOnSkill = await fetch(`${base}/skills`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "Unexpected image field",
        imageUrl: "https://cdn.example.com/skills/react.png",
        published: false,
      }),
    });
    assert.equal(imageOnSkill.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
});
