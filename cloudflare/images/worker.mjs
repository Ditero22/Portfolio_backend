export default {
  async fetch(request, env) {
    if (!["GET", "HEAD"].includes(request.method)) {
      return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const key = url.pathname.replace(/^\/+/, "");
    const publicImage = ["blog/", "projects/", "certifications/"].some(
      (prefix) => key.startsWith(prefix),
    );

    if (!publicImage || key.includes("..")) {
      return new Response("Not found", { status: 404 });
    }

    const object = await env.IMAGES.get(key);
    if (!object) return new Response("Not found", { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public, max-age=31536000, immutable");

    return new Response(request.method === "HEAD" ? null : object.body, {
      headers,
    });
  },
};
