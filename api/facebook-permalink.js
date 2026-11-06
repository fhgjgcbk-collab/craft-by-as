const TRACKING_PARAMETERS = [
  "mibextid",
  "rdid",
  "share_url",
  "__tn__",
  "__cft__",
];

function isFacebookHost(hostname) {
  const host = hostname.toLowerCase();
  return (
    host === "facebook.com" ||
    host.endsWith(".facebook.com") ||
    host === "fb.watch" ||
    host === "fb.me"
  );
}

function parseFacebookUrl(value, base) {
  let url;
  try {
    url = new URL(value, base);
  } catch {
    return null;
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !isFacebookHost(url.hostname) ||
    url.port ||
    url.username ||
    url.password
  ) {
    return null;
  }
  url.protocol = "https:";
  return url;
}

function canonicalPermalink(value, base) {
  const url = parseFacebookUrl(value, base);
  if (
    !url ||
    /^\/(?:share|login|checkpoint|plugins)(?:\/|$)/i.test(url.pathname)
  ) {
    return null;
  }
  url.hostname = "www.facebook.com";
  url.hash = "";
  TRACKING_PARAMETERS.forEach((parameter) =>
    url.searchParams.delete(parameter),
  );
  return url.href;
}

function permalinkFromLogin(url) {
  let candidate = url;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!/\/(?:login|checkpoint)(?:\/|$)/i.test(candidate.pathname)) break;
    const next = candidate.searchParams.get("next");
    if (!next) return null;
    candidate = parseFacebookUrl(next, candidate.origin);
    if (!candidate) return null;
  }
  return canonicalPermalink(candidate.href);
}

function extractCanonicalUrl(html, base) {
  const tags = html.match(/<(?:link|meta)\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const key =
      tag.match(/\b(?:property|name)\s*=\s*["'](?:og:url|twitter:url)["']/i) ||
      tag.match(/\brel\s*=\s*["']canonical["']/i);
    const content = tag.match(/\b(?:content|href)\s*=\s*["']([^"']+)["']/i);
    if (!key || !content) continue;
    const permalink = canonicalPermalink(
      content[1].replace(/&amp;/g, "&"),
      base,
    );
    if (permalink) return permalink;
  }
  return null;
}

async function readHtml(response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  const limit = 256 * 1024;
  while (length < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = value.subarray(0, limit - length);
    chunks.push(Buffer.from(chunk));
    length += chunk.length;
    if (chunk.length < value.length) {
      await reader.cancel();
      break;
    }
  }
  if (length >= limit) await reader.cancel();
  return Buffer.concat(chunks).toString("utf8");
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  const input = typeof req.query.url === "string" ? req.query.url : "";
  let current = parseFacebookUrl(input);
  if (
    !current ||
    input.length > 2048 ||
    (!/^\/share(?:\/|$)/i.test(current.pathname) &&
      current.hostname !== "fb.watch" &&
      current.hostname !== "fb.me")
  ) {
    return res
      .status(400)
      .json({ error: "Le lien doit être un lien de partage Facebook valide." });
  }

  try {
    for (let redirects = 0; redirects <= 5; redirects += 1) {
      const response = await fetch(current, {
        redirect: "manual",
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent":
            "Mozilla/5.0 (compatible; PortfolioPreview/1.0; +https://craft-by-as.vercel.app)",
        },
        signal: AbortSignal.timeout(8000),
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        const next = location && parseFacebookUrl(location, current.href);
        if (!next) {
          return res.status(422).json({
            error:
              "Facebook a redirigé vers une adresse qui ne peut pas être intégrée.",
          });
        }
        const permalink = permalinkFromLogin(next);
        if (permalink) {
          res.setHeader(
            "Cache-Control",
            "public, s-maxage=3600, stale-while-revalidate=86400",
          );
          return res.status(200).json({ permalink });
        }
        current = next;
        continue;
      }

      const loginPermalink = permalinkFromLogin(current);
      if (loginPermalink) {
        res.setHeader(
          "Cache-Control",
          "public, s-maxage=3600, stale-while-revalidate=86400",
        );
        return res.status(200).json({ permalink: loginPermalink });
      }

      const html = response.ok ? await readHtml(response) : "";
      const permalink =
        extractCanonicalUrl(html, current.href) ||
        canonicalPermalink(current.href);
      if (permalink) {
        res.setHeader(
          "Cache-Control",
          "public, s-maxage=3600, stale-while-revalidate=86400",
        );
        return res.status(200).json({ permalink });
      }
      break;
    }
  } catch (error) {
    console.error("Facebook permalink resolution failed:", error.message);
    return res.status(502).json({
      error:
        "Facebook n’a pas répondu. Vous pouvez téléverser le visuel directement.",
    });
  }

  return res.status(422).json({
    error:
      "Le permalien de la publication n’a pas pu être trouvé. Utilisez son adresse directe ou téléversez le visuel.",
  });
};
