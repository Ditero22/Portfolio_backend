INSERT INTO "PortfolioContent" (
    "id",
    "kind",
    "title",
    "subtitle",
    "description",
    "category",
    "url",
    "published",
    "sortOrder",
    "createdAt",
    "updatedAt"
)
VALUES
    ('resource-mdn-web-docs', 'RESOURCE', 'MDN Web Docs', 'HTML, CSS, JavaScript, and browser API references', 'Practical guides and references for HTML, CSS, JavaScript, and browser APIs.', 'Web development', 'https://developer.mozilla.org/en-US/docs/Web', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('resource-react-learn', 'RESOURCE', 'React Learn', 'Learning React components, state, and events', 'The official React learning path for components, state, events, and more.', 'Web development', 'https://react.dev/learn', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('resource-typescript-handbook', 'RESOURCE', 'TypeScript Handbook', 'Writing safer JavaScript with TypeScript', 'Clear documentation for writing safer JavaScript with TypeScript.', 'Web development', 'https://www.typescriptlang.org/docs/', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('resource-devdocs', 'RESOURCE', 'DevDocs', 'Quick, searchable API references', 'A fast, searchable reference that keeps developer documentation in one place.', 'Web development', 'https://devdocs.io/', true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('resource-feather-icons', 'RESOURCE', 'Feather Icons', 'Simple, consistent icons for interface design', 'A clean set of open-source icons I can use in interfaces and projects.', 'Web development', 'https://feathericons.com/', true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('resource-udemy', 'RESOURCE', 'Udemy', 'Structured courses and guided lessons', 'Courses and guided lessons I use to keep building new skills.', 'Web development', 'https://www.udemy.com/', true, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('resource-cisco-skills-for-all', 'RESOURCE', 'Cisco Skills for All', 'Free networking lessons and Packet Tracer labs', 'Free learning resources and Packet Tracer labs for practicing networking concepts.', 'Networking', 'https://www.skillsforall.com/', true, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('resource-packet-tracer', 'RESOURCE', 'Packet Tracer', 'Practicing network topologies and device configuration', 'A network simulation tool for experimenting with routers, switches, and topologies.', 'Networking', 'https://www.skillsforall.com/resources/lab-downloads', true, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('resource-chatgpt-networking', 'RESOURCE', 'ChatGPT', 'Discussing Packet Tracer exercises and networking concepts', 'A learning companion I use to discuss Packet Tracer exercises, questions, and networking concepts as I practice.', 'Networking', 'https://chatgpt.com/', true, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('resource-github-docs', 'RESOURCE', 'GitHub Docs', 'Git workflows, repositories, and collaboration', 'Guides for version control, repositories, collaboration, and shipping code.', 'Build and ship', 'https://docs.github.com/', true, 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('resource-vite-guide', 'RESOURCE', 'Vite Guide', 'Setting up modern frontend tooling', 'Fast setup and documentation for modern frontend projects.', 'Build and ship', 'https://vite.dev/guide/', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('resource-youtube', 'RESOURCE', 'YouTube', 'Hands-on tutorials across development topics', 'Tutorial practice for Java, React, advanced networking, Node and Express, Drizzle and Prisma, and Supabase.', 'Video learning', 'https://www.youtube.com/', true, 11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
