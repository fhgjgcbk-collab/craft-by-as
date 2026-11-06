const FACEBOOK_SHORTLINK_HOSTS = new Set(["fb.watch", "fb.me"]);

function isFacebookHost(hostname) {
  const host = hostname.toLowerCase();
  return (
    host === "facebook.com" ||
    host.endsWith(".facebook.com") ||
    FACEBOOK_SHORTLINK_HOSTS.has(host)
  );
}

export function isFacebookLink(value) {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) && isFacebookHost(url.hostname)
    );
  } catch {
    return false;
  }
}

export async function resolveFacebookEmbedSrc(value) {
  const url = new URL(value);
  if (!isFacebookLink(value)) {
    throw new Error("Le lien fourni n’est pas une URL Facebook valide.");
  }

  const isShortlink =
    /^\/share(?:\/|$)/i.test(url.pathname) ||
    FACEBOOK_SHORTLINK_HOSTS.has(url.hostname.toLowerCase());
  let permalink = url;
  if (isShortlink) {
    const endpoint = new URL("/api/facebook-permalink", window.location.origin);
    endpoint.searchParams.set("url", url.href);
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Facebook n’a pas fourni de permalien.");
    }
    permalink = new URL(result.permalink);
  }

  if (!isFacebookHost(permalink.hostname)) {
    throw new Error("Le permalien Facebook reçu n’est pas valide.");
  }
  permalink.protocol = "https:";
  permalink.hostname = "www.facebook.com";
  permalink.hash = "";

  const embed = new URL("https://www.facebook.com/plugins/post.php");
  embed.searchParams.set("href", permalink.href);
  embed.searchParams.set("show_text", "true");
  embed.searchParams.set("width", "500");
  return embed.href;
}
