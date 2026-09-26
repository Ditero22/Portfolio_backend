import bcrypt from "bcrypt";
import prisma from "../src/database/prisma.js";

import blogPosts from "./sampledata/blogPosts.js"; // Import the sample blog posts will delete later
import projects from "./sampledata/projects.js";

async function main() {
  const pin = "22140709";
  const pinHash = await bcrypt.hash(pin, 12);
  await prisma.user.upsert({
    where: {
      id: "admin",
    },
    update: {
      pinHash,
    },
    create: {
      id: "admin",
      pinHash,
      role: "admin",
    },
  });
  console.log("Admin account created.");

  for (const post of blogPosts) {
    await prisma.blogPost.upsert({
      where: {
        slug: post.slug,
      },
      update: post,
      create: post,
    });
  }

  console.log("Blog posts seeded successfully.");
  for (const project of projects) {
    const existing = await prisma.project.findFirst({
      where: { title: project.title },
    });
    if (existing)
      await prisma.project.update({
        where: { id: existing.id },
        data: project,
      });
    else await prisma.project.create({ data: project });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
