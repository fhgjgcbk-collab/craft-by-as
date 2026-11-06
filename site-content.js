import {
  getImageUrl,
  isSupabaseConfigured,
  supabase,
} from "./supabase-client.js";

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
    cover.textContent = entry.emoji || "✦";
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

  const [profileResult, journeyResult, projectsResult] = await Promise.all([
    supabase.from("portfolio_profile").select("*").eq("id", 1).maybeSingle(),
    supabase
      .from("portfolio_journey")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("portfolio_projects")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);
  const error =
    profileResult.error || journeyResult.error || projectsResult.error;
  if (error) throw error;

  renderProfile(profileResult.data);
  renderJourney(journeyResult.data || []);
  renderProjects(projectsResult.data || []);
}

loadSiteContent().catch(showContentError);
