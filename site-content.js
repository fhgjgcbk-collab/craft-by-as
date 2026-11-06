import {
  getDocumentUrl,
  getImageUrl,
  isSupabaseConfigured,
  supabase,
} from "./supabase-client.js";
import { isFacebookLink, resolveFacebookEmbedSrc } from "./facebook-embed.js";

const setText = (selector, value) => {
  if (value == null) return;
  document.querySelectorAll(selector).forEach((element) => {
    element.textContent = value;
  });
};

function showContentError(error) {
  let notice = document.getElementById("cms-status");
  if (!notice) {
    notice = document.createElement("p");
    notice.id = "cms-status";
    notice.setAttribute("role", "status");
    document.body.append(notice);
  }
  notice.textContent =
    "Les contenus enregistrés n’ont pas pu être chargés. La version locale du portfolio est affichée. " +
    error.message;
  notice.hidden = false;
}

function renderProfile(profile) {
  if (!profile) return;

  Object.entries(profile).forEach(([key, value]) => {
    if (typeof value === "string" && key !== "about_text") {
      setText(`[data-cms="${key}"]`, value);
    }
  });

  const paragraphs = document.querySelector("[data-cms-paragraphs]");
  if (paragraphs && typeof profile.about_text === "string") {
    paragraphs.replaceChildren(
      ...profile.about_text
        .split(/\n\s*\n/)
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text) => {
          const paragraph = document.createElement("p");
          paragraph.textContent = text;
          return paragraph;
        }),
    );
  }

  if (profile.photo_path) {
    const photo = document.querySelector(".about-photo-frame img");
    if (photo) photo.src = getImageUrl(profile.photo_path);
  }

  if (profile.cv_path) {
    const previewFrame = document.querySelector(".cv-preview-frame");
    if (previewFrame) {
      const preview = document.createElement("iframe");
      preview.src = `${getDocumentUrl(profile.cv_path)}#page=1&view=Fit&toolbar=0&navpanes=0&scrollbar=0`;
      preview.title = "Aperçu du CV d’Angie Sohane Ndaghy Pambo";
      preview.loading = "lazy";
      previewFrame.replaceChildren(preview);
    }

    document.querySelectorAll("[data-cv]").forEach((link) => {
      const isDownload = link.dataset.cv === "download";
      link.href = getDocumentUrl(profile.cv_path, isDownload);
      link.dataset.cvManaged = "true";
      if (isDownload) {
        link.removeAttribute("target");
      } else {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
    });
  }

  document.querySelectorAll('a[href^="mailto:"]').forEach((link) => {
    link.href = `mailto:${profile.contact_email}`;
    if (link.textContent.includes("@")) {
      link.textContent = profile.contact_email;
    }
  });
}

function renderJourney(entries) {
  const list = document.querySelector("[data-cms-journey]");
  const highlights = document.querySelector("[data-cms-journey-highlights]");
  if (!list || !highlights) return;

  list.replaceChildren();
  highlights.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "section-sub";
    empty.textContent = "Le parcours sera bientôt renseigné.";
    list.append(empty);
    return;
  }

  entries.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "journey-card reveal visible";

    const period = document.createElement("span");
    period.className = "journey-period";
    period.textContent = entry.period || "Parcours";
    const heading = document.createElement("h3");
    heading.textContent = entry.title;
    const organization = document.createElement("p");
    organization.className = "journey-organization";
    organization.textContent = entry.organization;
    card.append(period, heading, organization);
    if (entry.description) {
      const description = document.createElement("p");
      description.className = "journey-description";
      description.textContent = entry.description;
      card.append(description);
    }
    list.append(card);

    const highlight = document.createElement("div");
    highlight.className = "cv-highlight-item";
    highlight.textContent = [entry.title, entry.organization]
      .filter(Boolean)
      .join(" — ");
    highlights.append(highlight);
  });
}

function renderSkills(groups) {
  const grid = document.querySelector(".skills-grid");
  if (!grid) return;

  const iconPaths = {
    "Design Graphique":
      "M12 3a9 9 0 1 0 0 18h1.2a2 2 0 0 0 1.5-3.3 1.8 1.8 0 0 1 1.4-3h1.4A3.5 3.5 0 0 0 21 11.2C20.3 6.5 16.4 3 12 3Z",
    "Production Audiovisuelle": "M3 6h13v12H3zM16 10l5-3v10l-5-3z",
    "Développement Web": "m8 8-4 4 4 4m8-8 4 4-4 4m-2-11-4 14",
    "Communication Digitale":
      "M3 11v2a2 2 0 0 0 2 2h3l10 5V4L8 9H5a2 2 0 0 0-2 2Zm5 4 2 6h4l-3-5",
    "Gestion de Projet": "M4 20V4m0 2h14l-2 4 2 4H4m0 2h14",
    "Création de Contenu":
      "m12 3 1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3Z",
  };
  grid.replaceChildren();

  groups.forEach((group) => {
    const card = document.createElement("article");
    card.className = "skill-card reveal visible";
    const iconContainer = document.createElement("div");
    iconContainer.className = "skill-card-icon";
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    icon.classList.add("icon");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      iconPaths[group.title] || iconPaths["Création de Contenu"],
    );
    icon.append(path);
    iconContainer.append(icon);
    const title = document.createElement("h3");
    title.textContent = group.title;
    const tags = document.createElement("div");
    tags.className = "skill-tags";
    (group.items || []).forEach((itemText) => {
      const tag = document.createElement("span");
      tag.className = "skill-tag";
      if (["HTML", "CSS", "JavaScript"].includes(itemText)) {
        tag.classList.add("gold");
      }
      tag.textContent = itemText;
      tags.append(tag);
    });
    card.append(iconContainer, title, tags);
    grid.append(card);
  });
}

function categoryFilter(category) {
  const value = category.toLocaleLowerCase("fr");
  if (value.includes("brand")) return "branding";
  if (value.includes("vidéo") || value.includes("audiovisuel")) return "video";
  if (value.includes("web")) return "web";
  if (value.includes("design") || value.includes("graphique")) return "design";
  return "all";
}

function createImage(path, title, className) {
  const image = document.createElement("img");
  image.src = getImageUrl(path);
  image.alt = title;
  image.loading = "lazy";
  image.dataset.galleryImage = "true";
  if (className) image.className = className;
  return image;
}

function createProjectIcon() {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.classList.add("project-icon");
  const frame = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  frame.setAttribute("x", "3");
  frame.setAttribute("y", "3");
  frame.setAttribute("width", "18");
  frame.setAttribute("height", "18");
  frame.setAttribute("rx", "3");
  const imageMark = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  imageMark.setAttribute("d", "m21 15-5-5L5 21M8.5 8.5h.01");
  icon.append(frame, imageMark);
  return icon;
}

function createProjectLink(url, title) {
  let destination;
  try {
    destination = new URL(url);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(destination.protocol)) return null;

  const link = document.createElement("a");
  link.className = "project-link";
  link.href = destination.href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", `Voir la réalisation : ${title}`);
  link.textContent = "Voir la réalisation";
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.classList.add("icon");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M14 4h6v6M20 4 10 14M18 13v6H5V6h6");
  icon.append(path);
  link.append(icon);
  return link;
}

function getProjectMediaSource(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  const host = url.hostname.toLowerCase();

  if (isFacebookLink(url.href)) {
    return {
      type: "facebook",
      src: url.href,
    };
  }

  const youtubeHosts = new Set([
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
    "youtu.be",
  ]);
  if (youtubeHosts.has(host)) {
    let videoId = "";
    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] || "";
    } else if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v") || "";
    } else {
      videoId =
        url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] || "";
    }
    return /^[\w-]{11}$/.test(videoId)
      ? {
          type: "embed",
          src: `https://www.youtube-nocookie.com/embed/${videoId}`,
        }
      : null;
  }

  const vimeoMatch = url.pathname.match(/^\/(?:video\/)?(\d+)(?:\/|$)/);
  if (
    (host === "vimeo.com" ||
      host === "www.vimeo.com" ||
      host === "player.vimeo.com") &&
    vimeoMatch
  ) {
    return {
      type: "embed",
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
    };
  }

  const pathname = url.pathname.toLowerCase();
  if (/\.(?:avif|gif|jpe?g|png|webp)$/.test(pathname)) {
    return { type: "image", src: url.href };
  }
  if (/\.(?:mp4|m4v|webm|ogv|ogg|mov)$/.test(pathname)) {
    return { type: "video", src: url.href };
  }
  return null;
}

function createProjectMediaPreview(url, title) {
  const media = getProjectMediaSource(url);
  if (!media) return null;

  const frame = document.createElement("div");
  frame.className = "project-media-preview";
  if (media.type === "image") {
    const image = document.createElement("img");
    image.src = media.src;
    image.alt = `Aperçu de ${title}`;
    image.loading = "lazy";
    image.addEventListener("error", () => showProjectMediaFallback(frame));
    frame.append(image);
  } else if (media.type === "video") {
    const video = document.createElement("video");
    video.src = media.src;
    video.controls = true;
    video.preload = "metadata";
    video.playsInline = true;
    video.setAttribute("aria-label", `Vidéo de ${title}`);
    video.addEventListener("error", () => showProjectMediaFallback(frame));
    frame.append(video);
  } else if (media.type === "facebook") {
    frame.classList.add("is-facebook");
    const message = document.createElement("span");
    message.textContent = "Chargement de l’aperçu Facebook…";
    frame.append(message);
    resolveFacebookEmbedSrc(media.src)
      .then((src) => {
        if (!frame.isConnected) return;
        const embed = document.createElement("iframe");
        embed.src = src;
        embed.title = `Aperçu Facebook de ${title}`;
        embed.loading = "lazy";
        embed.allowFullscreen = true;
        embed.classList.add("facebook-embed");
        frame.replaceChildren(embed);
      })
      .catch(() =>
        showProjectMediaFallback(
          frame,
          "Aperçu Facebook indisponible. Ouvrez le lien ou téléversez le visuel.",
        ),
      );
  } else {
    const embed = document.createElement("iframe");
    embed.src = media.src;
    embed.title = `Aperçu vidéo de ${title}`;
    embed.loading = "lazy";
    embed.referrerPolicy = "strict-origin-when-cross-origin";
    embed.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    embed.allowFullscreen = true;
    frame.append(embed);
  }
  return frame;
}

function showProjectMediaFallback(
  frame,
  message = "Aperçu indisponible. Utilisez le lien pour ouvrir la réalisation.",
) {
  frame.replaceChildren();
  frame.classList.add("is-unavailable");
  frame.textContent = message;
}

function renderEntry(entry) {
  const isWork = entry.content_type === "work";
  const visualStyle = {
    "INPTIC MAG": "mag",
    MindCare: "mindcare",
    "Portfolio Professionnel": "portfolio",
    "Identité visuelle Shine": "shine",
    "Affiche R-hair": "rhair",
    "Teaser INPTIC MAG": "teaser",
    "Campagne santé mentale": "campaign",
    "Portfolio professionnel": "portfolio",
    "Pub Prépa Berthe & Émile": "prepa",
  }[entry.title];
  const card = document.createElement("article");
  card.className = `${isWork ? "work-card" : "project-card"} reveal visible`;
  if (isWork) card.dataset.cat = categoryFilter(entry.category);

  const imagePaths = Array.isArray(entry.image_paths) ? entry.image_paths : [];
  const cover = document.createElement("div");
  cover.className = isWork ? "work-thumb" : "project-thumb";
  if (visualStyle) {
    cover.classList.add(
      `${isWork ? "work-thumb" : "project-thumb"}-${visualStyle}`,
    );
  }
  if (imagePaths.length) {
    cover.append(
      createImage(
        imagePaths[0],
        entry.title,
        isWork ? "work-cover-image" : "project-cover-image",
      ),
    );
  } else {
    cover.append(createProjectIcon());
  }

  const details = document.createElement("div");
  details.className = isWork ? "work-info" : "project-body";
  if (isWork) {
    const category = document.createElement("div");
    category.className = "work-cat";
    category.textContent = entry.category;
    const title = document.createElement("div");
    title.className = "work-title";
    title.textContent = entry.title;
    details.append(category, title);
  } else {
    const category = document.createElement("p");
    category.className = "project-category";
    category.textContent = entry.category;
    const title = document.createElement("h3");
    title.textContent = entry.title;
    const description = document.createElement("p");
    description.textContent = entry.description;
    details.append(category, title);
    if (entry.description) details.append(description);

    const tags = document.createElement("div");
    tags.className = "project-pills";
    (entry.tags || []).forEach((text) => {
      const tag = document.createElement("span");
      tag.className = "project-pill";
      tag.textContent = text;
      tags.append(tag);
    });
    if (tags.childElementCount) details.append(tags);
  }

  if (entry.project_url) {
    const link = createProjectLink(entry.project_url, entry.title);
    if (link) {
      const resource = document.createElement("div");
      resource.className = "project-resource";
      resource.append(link);
      const preview = createProjectMediaPreview(entry.project_url, entry.title);
      if (preview) resource.append(preview);
      details.append(resource);
    }
  }

  const galleryPaths = imagePaths.slice(1);
  if (galleryPaths.length) {
    const gallery = document.createElement("div");
    gallery.className = "project-gallery";
    galleryPaths.forEach((path) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "project-gallery-item";
      button.setAttribute("aria-label", `Agrandir une photo de ${entry.title}`);
      button.append(createImage(path, entry.title));
      gallery.append(button);
    });
    details.append(gallery);
  }

  card.append(cover, details);
  return card;
}

function renderProjects(entries) {
  const projects = document.querySelector(".projects-grid");
  const works = document.querySelector(".works-grid");
  if (!projects || !works) return;

  projects.replaceChildren();
  works.replaceChildren();
  entries.forEach((entry) => {
    (entry.content_type === "work" ? works : projects).append(
      renderEntry(entry),
    );
  });
  const projectCount = entries.filter(
    (entry) => entry.content_type === "project",
  ).length;
  const projectCountLabel = document.querySelector(".stats .stat b");
  if (projectCountLabel) projectCountLabel.textContent = String(projectCount);
}

async function loadSiteContent() {
  if (!isSupabaseConfigured || !supabase) return;

  const [profileResult, journeyResult, projectsResult, skillsResult] =
    await Promise.all([
      supabase.from("portfolio_profile").select("*").eq("id", 1).maybeSingle(),
      supabase
        .from("portfolio_journey")
        .select("*")
        .order("sort_order", { ascending: true }),
      supabase
        .from("portfolio_projects")
        .select("*")
        .order("sort_order", { ascending: true }),
      supabase
        .from("portfolio_skills")
        .select("*")
        .order("sort_order", { ascending: true }),
    ]);
  const error =
    profileResult.error ||
    journeyResult.error ||
    projectsResult.error ||
    skillsResult.error;
  if (error) throw error;

  renderProfile(profileResult.data);
  renderJourney(journeyResult.data || []);
  renderProjects(projectsResult.data || []);
  renderSkills(skillsResult.data || []);
}

loadSiteContent().catch(showContentError);
