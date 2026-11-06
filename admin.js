import {
  getImageUrl,
  isSupabaseConfigured,
  STORAGE_BUCKET,
  supabase,
} from "./supabase-client.js";

const $ = (selector) => document.querySelector(selector);
const loginView = $("#login-view");
const passwordView = $("#password-view");
const dashboard = $("#dashboard");
const status = $("#status");
const journeyForm = $("#journey-form");
const projectForm = $("#project-form");
const profileForm = $("#profile-form");
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

let profile = null;
let journeyEntries = [];
let projects = [];
let projectImages = [];
let previewUrl = "";

function showStatus(message, kind = "success") {
  status.textContent = message;
  status.dataset.kind = kind;
  status.hidden = false;
}

function clearStatus() {
  status.hidden = true;
  status.textContent = "";
}

function setBusy(form, busy) {
  form.querySelectorAll('button[type="submit"]').forEach((button) => {
    button.disabled = busy;
  });
}

function fillForm(form, values) {
  Object.entries(values).forEach(([name, value]) => {
    const field = form.elements.namedItem(name);
    if (field) field.value = value ?? "";
  });
}

function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function displayLogin(message) {
  dashboard.hidden = true;
  passwordView.hidden = true;
  loginView.hidden = false;
  if (message) showStatus(message, "error");
}

function displayPasswordForm() {
  dashboard.hidden = true;
  loginView.hidden = true;
  passwordView.hidden = false;
  clearStatus();
}

async function showDashboard(session) {
  const { data, error } = await supabase
    .from("portfolio_admins")
    .select("user_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) {
    await supabase.auth.signOut();
    displayLogin(`Vérification des droits impossible : ${error.message}`);
    return;
  }
  if (!data) {
    await supabase.auth.signOut();
    displayLogin("Ce compte n’a pas les droits d’administration.");
    return;
  }

  clearStatus();
  loginView.hidden = true;
  passwordView.hidden = true;
  dashboard.hidden = false;
  $("#signed-in-as").textContent = `Connecté en tant que ${session.user.email}`;
  const loadError = await loadContent();
  if (loadError) {
    const { error: signOutError } = await supabase.auth.signOut();
    displayLogin(
      `Impossible de charger les contenus : ${loadError}${
        signOutError ? ` La déconnexion a échoué : ${signOutError.message}` : ""
      }`,
    );
  }
}

async function saveNewPassword(event) {
  event.preventDefault();
  clearStatus();
  const form = event.currentTarget;
  const password = $("#new-password").value;
  if (password.length < 8) {
    showStatus("Choisissez un mot de passe d’au moins 8 caractères.", "error");
    return;
  }
  if (password !== $("#confirm-password").value) {
    showStatus("Les deux mots de passe ne correspondent pas.", "error");
    return;
  }

  setBusy(form, true);
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;

    form.reset();
    window.history.replaceState({}, "", window.location.pathname);
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) {
      displayLogin("Mot de passe enregistré. Connectez-vous avec celui-ci.");
      return;
    }

    await showDashboard(session);
  } catch (error) {
    showStatus(
      `Impossible d’enregistrer le mot de passe : ${error.message}`,
      "error",
    );
  } finally {
    setBusy(form, false);
  }
}

async function loadContent() {
  let profileResult;
  let journeyResult;
  let projectsResult;
  try {
    [profileResult, journeyResult, projectsResult] = await Promise.all([
      supabase.from("portfolio_profile").select("*").eq("id", 1).single(),
      supabase
        .from("portfolio_journey")
        .select("*")
        .order("sort_order", { ascending: true }),
      supabase
        .from("portfolio_projects")
        .select("*")
        .order("content_type", { ascending: true })
        .order("sort_order", { ascending: true }),
    ]);
  } catch (error) {
    return error.message;
  }
  const error =
    profileResult.error || journeyResult.error || projectsResult.error;
  if (error) {
    return error.message;
  }

  profile = profileResult.data;
  journeyEntries = journeyResult.data || [];
  projects = projectsResult.data || [];
  fillForm(profileForm, profile);
  setProfilePreview(profile.photo_path ? getImageUrl(profile.photo_path) : "");
  renderJourneyList();
  renderProjectList();
  return "";
}

function setProfilePreview(src) {
  const preview = $("#profile-photo-preview");
  if (!src) {
    preview.hidden = true;
    preview.removeAttribute("src");
    return;
  }
  preview.src = src;
  preview.hidden = false;
}

function validateFiles(files) {
  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      throw new Error(
        `${file.name} n’est pas un format accepté (JPEG, PNG, WebP ou GIF).`,
      );
    }
    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error(`${file.name} dépasse la limite de 5 Mo.`);
    }
  }
}

async function uploadImage(file) {
  validateFiles([file]);
  const safeName = file.name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-");
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!data.user) throw new Error("Session expirée. Reconnectez-vous.");
  const path = `${data.user.id}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  return path;
}

async function removeImages(paths) {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(paths);
  if (error) throw error;
}

async function saveProfile(event) {
  event.preventDefault();
  clearStatus();
  setBusy(profileForm, true);
  let uploadedPath = "";
  try {
    const values = formValues(profileForm);
    const photoFile = $("#profile-photo").files[0];
    if (photoFile) uploadedPath = await uploadImage(photoFile);

    const { error } = await supabase
      .from("portfolio_profile")
      .update({
        ...values,
        photo_path: uploadedPath || profile.photo_path,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
      .select("id")
      .single();
    if (error) throw error;

    const oldPhoto = profile.photo_path;
    const newPhotoPath = uploadedPath || profile.photo_path;
    profile = {
      ...profile,
      ...values,
      photo_path: newPhotoPath,
    };
    uploadedPath = "";
    $("#profile-photo").value = "";
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = "";
    }
    setProfilePreview(
      profile.photo_path ? getImageUrl(profile.photo_path) : "",
    );
    if (newPhotoPath !== oldPhoto && oldPhoto) {
      try {
        await removeImages([oldPhoto]);
      } catch (error) {
        showStatus(
          `Profil enregistré, mais l’ancienne photo n’a pas pu être supprimée : ${error.message}`,
          "error",
        );
        return;
      }
    }
    showStatus("Profil enregistré.");
  } catch (error) {
    const cleanupWarning = await cleanupUploadedImages(
      uploadedPath ? [uploadedPath] : [],
    );
    showStatus(
      `Échec de l’enregistrement du profil : ${error.message}${cleanupWarning}`,
      "error",
    );
  } finally {
    setBusy(profileForm, false);
  }
}

function renderJourneyList() {
  const list = $("#journey-list");
  list.replaceChildren();
  if (!journeyEntries.length) {
    list.textContent = "Aucune étape de parcours pour le moment.";
    return;
  }

  journeyEntries.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "entry-card";
    const content = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = entry.title;
    const meta = document.createElement("p");
    meta.className = "entry-meta";
    meta.textContent = [entry.period, entry.organization]
      .filter(Boolean)
      .join(" · ");
    const description = document.createElement("p");
    description.textContent = entry.description || "";
    content.append(title, meta, description);
    const actions = document.createElement("div");
    actions.className = "entry-actions";
    actions.append(
      makeActionButton("Modifier", "button-quiet", () => editJourney(entry)),
      makeActionButton("Supprimer", "button-danger", () =>
        deleteJourney(entry),
      ),
    );
    card.append(content, actions);
    list.append(card);
  });
}

function makeActionButton(label, className, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `button ${className}`;
  button.textContent = label;
  button.addEventListener("click", action);
  return button;
}

function openJourneyEditor(entry = null) {
  journeyForm.reset();
  fillForm(journeyForm, entry || {});
  $("#journey-form-title").textContent = entry
    ? "Modifier une étape"
    : "Ajouter une étape";
  journeyForm.hidden = false;
  journeyForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editJourney(entry) {
  openJourneyEditor(entry);
}

async function saveJourney(event) {
  event.preventDefault();
  clearStatus();
  setBusy(journeyForm, true);
  try {
    const values = formValues(journeyForm);
    const record = {
      period: values.period.trim(),
      title: values.title.trim(),
      organization: values.organization.trim(),
      description: values.description.trim(),
      sort_order: values.id
        ? (journeyEntries.findIndex((entry) => entry.id === values.id) + 1) * 10
        : (journeyEntries.length + 1) * 10,
    };
    const result = values.id
      ? await supabase
          .from("portfolio_journey")
          .update(record)
          .eq("id", values.id)
          .select("id")
          .single()
      : await supabase
          .from("portfolio_journey")
          .insert(record)
          .select("id")
          .single();
    if (result.error) throw result.error;
    journeyForm.hidden = true;
    const loadError = await loadContent();
    if (loadError) {
      showStatus(
        `Étape enregistrée, mais impossible d’actualiser la liste : ${loadError}`,
        "error",
      );
      return;
    }
    showStatus("Étape de parcours enregistrée.");
  } catch (error) {
    showStatus(`Échec de l’enregistrement : ${error.message}`, "error");
  } finally {
    setBusy(journeyForm, false);
  }
}

async function deleteJourney(entry) {
  if (!window.confirm(`Supprimer « ${entry.title} » du parcours ?`)) return;
  try {
    const { error } = await supabase
      .from("portfolio_journey")
      .delete()
      .eq("id", entry.id);
    if (error) throw error;
    const loadError = await loadContent();
    if (loadError) {
      showStatus(
        `Étape supprimée, mais impossible d’actualiser la liste : ${loadError}`,
        "error",
      );
      return;
    }
    showStatus("Étape de parcours supprimée.");
  } catch (error) {
    showStatus(`Suppression impossible : ${error.message}`, "error");
  }
}

function renderProjectList() {
  const list = $("#project-list");
  list.replaceChildren();
  if (!projects.length) {
    list.textContent = "Aucun projet ou création pour le moment.";
    return;
  }

  projects.forEach((project) => {
    const card = document.createElement("article");
    card.className = "entry-card";
    const content = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = project.title;
    const meta = document.createElement("p");
    meta.className = "entry-meta";
    meta.textContent = `${project.content_type === "project" ? "Projet" : "Création"} · ${project.category}`;
    const description = document.createElement("p");
    description.textContent = project.description || "";
    const imageCount = document.createElement("p");
    const count = project.image_paths?.length || 0;
    imageCount.textContent = `${count} photo${count === 1 ? "" : "s"}`;
    content.append(title, meta, description, imageCount);
    const actions = document.createElement("div");
    actions.className = "entry-actions";
    actions.append(
      makeActionButton("Modifier", "button-quiet", () => editProject(project)),
      makeActionButton("Supprimer", "button-danger", () =>
        deleteProject(project),
      ),
    );
    card.append(content, actions);
    list.append(card);
  });
}

function renderProjectImages() {
  const list = $("#project-image-list");
  list.replaceChildren();
  projectImages.forEach((image, index) => {
    const item = document.createElement("div");
    item.className = `image-item${image.remove ? " is-removed" : ""}`;
    const preview = document.createElement("img");
    preview.src = image.url;
    preview.alt = "Photo du projet";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = image.remove ? "Conserver" : "Retirer";
    remove.addEventListener("click", () => {
      projectImages[index].remove = !projectImages[index].remove;
      renderProjectImages();
    });
    item.append(preview, remove);
    list.append(item);
  });
}

function openProjectEditor(project = null) {
  projectForm.reset();
  fillForm(projectForm, {
    emoji: "✦",
    ...(project || {}),
    tags: project?.tags?.join(", ") || "",
  });
  projectImages = (project?.image_paths || []).map((path) => ({
    path,
    url: getImageUrl(path),
    remove: false,
  }));
  renderProjectImages();
  $("#project-form-title").textContent = project
    ? "Modifier un contenu"
    : "Ajouter un contenu";
  projectForm.hidden = false;
  projectForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editProject(project) {
  openProjectEditor(project);
}

async function cleanupUploadedImages(paths) {
  if (!paths.length) return "";
  try {
    await removeImages(paths);
    return "";
  } catch (error) {
    return ` Les images téléversées temporaires n’ont pas pu être nettoyées : ${error.message}`;
  }
}

async function saveProject(event) {
  event.preventDefault();
  clearStatus();
  setBusy(projectForm, true);
  const uploadedPaths = [];
  try {
    const values = formValues(projectForm);
    const files = Array.from($("#project-images").files);
    validateFiles(files);
    for (const file of files) {
      uploadedPaths.push(await uploadImage(file));
    }

    const retainedPaths = projectImages
      .filter((image) => !image.remove)
      .map((image) => image.path);
    const removedPaths = projectImages
      .filter((image) => image.remove)
      .map((image) => image.path);
    const record = {
      content_type: values.content_type,
      title: values.title.trim(),
      category: values.category.trim(),
      description: values.description.trim(),
      tags: values.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      emoji: values.emoji.trim() || "✦",
      image_paths: [...retainedPaths, ...uploadedPaths],
      sort_order: values.id
        ? (projects.findIndex((project) => project.id === values.id) + 1) * 10
        : (projects.length + 1) * 10,
      updated_at: new Date().toISOString(),
    };
    const result = values.id
      ? await supabase
          .from("portfolio_projects")
          .update(record)
          .eq("id", values.id)
          .select("id")
          .single()
      : await supabase
          .from("portfolio_projects")
          .insert(record)
          .select("id")
          .single();
    if (result.error) throw result.error;

    uploadedPaths.length = 0;
    projectForm.hidden = true;
    $("#project-images").value = "";
    const loadError = await loadContent();
    if (loadError) {
      showStatus(
        `Contenu enregistré, mais impossible d’actualiser la liste : ${loadError}`,
        "error",
      );
      return;
    }
    try {
      await removeImages(removedPaths);
    } catch (error) {
      showStatus(
        `Contenu enregistré, mais certaines anciennes photos n’ont pas pu être supprimées : ${error.message}`,
        "error",
      );
      return;
    }
    showStatus("Contenu enregistré.");
  } catch (error) {
    const cleanupWarning = await cleanupUploadedImages(uploadedPaths);
    showStatus(
      `Échec de l’enregistrement : ${error.message}${cleanupWarning}`,
      "error",
    );
  } finally {
    setBusy(projectForm, false);
  }
}

async function deleteProject(project) {
  if (!window.confirm(`Supprimer « ${project.title} » et ses photos ?`)) return;
  try {
    const { error } = await supabase
      .from("portfolio_projects")
      .delete()
      .eq("id", project.id);
    if (error) throw error;
    const loadError = await loadContent();
    if (loadError) {
      showStatus(
        `Contenu supprimé, mais impossible d’actualiser la liste : ${loadError}`,
        "error",
      );
      return;
    }
    try {
      await removeImages(project.image_paths || []);
      showStatus("Contenu et photos supprimés.");
    } catch (error) {
      showStatus(
        `Contenu supprimé, mais certaines photos n’ont pas pu être supprimées : ${error.message}`,
        "error",
      );
    }
  } catch (error) {
    showStatus(`Suppression impossible : ${error.message}`, "error");
  }
}

function selectTab(tabId) {
  document.querySelectorAll(".tab").forEach((tab) => {
    const active = tab.dataset.tab === tabId;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.hidden = panel.id !== tabId;
  });
}

function bindEvents() {
  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearStatus();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: $("#login-email").value.trim(),
        password: $("#login-password").value,
      });
      if (error) throw error;
      await showDashboard(data.session);
    } catch (error) {
      showStatus(`Connexion impossible : ${error.message}`, "error");
    } finally {
      button.disabled = false;
    }
  });

  $("#sign-out").addEventListener("click", async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      displayLogin("Vous êtes déconnecté.");
    } catch (error) {
      showStatus(`Déconnexion impossible : ${error.message}`, "error");
    }
  });

  $("#password-form").addEventListener("submit", saveNewPassword);

  $("#forgot-password").addEventListener("click", async () => {
    clearStatus();
    const email = $("#login-email").value.trim();
    if (!email) {
      showStatus(
        "Saisissez votre adresse e-mail avant de demander un lien.",
        "error",
      );
      $("#login-email").focus();
      return;
    }

    const button = $("#forgot-password");
    button.disabled = true;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${window.location.pathname}?set-password=1`,
      });
      if (error) throw error;
      showStatus(
        "Si cette adresse possède un compte, un lien pour choisir un nouveau mot de passe va lui être envoyé.",
      );
    } catch (error) {
      showStatus(`Impossible d’envoyer le lien : ${error.message}`, "error");
    } finally {
      button.disabled = false;
    }
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => selectTab(tab.dataset.tab));
  });
  $("#profile-photo").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      validateFiles([file]);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(file);
      setProfilePreview(previewUrl);
      clearStatus();
    } catch (error) {
      event.target.value = "";
      showStatus(error.message, "error");
    }
  });
  profileForm.addEventListener("submit", saveProfile);
  $("#new-journey").addEventListener("click", () => openJourneyEditor());
  $("#new-project").addEventListener("click", () => openProjectEditor());
  journeyForm.addEventListener("submit", saveJourney);
  projectForm.addEventListener("submit", saveProject);
  document.querySelectorAll("[data-cancel]").forEach((button) => {
    button.addEventListener("click", () => {
      journeyForm.hidden = true;
      projectForm.hidden = true;
      clearStatus();
    });
  });
}

async function initialize() {
  if (!isSupabaseConfigured || !supabase) {
    $("#config-notice").hidden = false;
    $("#login-form")
      .querySelectorAll("input, button")
      .forEach((field) => (field.disabled = true));
    return;
  }

  bindEvents();
  const passwordUpdateRequired =
    new URLSearchParams(window.location.search).get("set-password") === "1";
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    displayLogin(`Impossible de vérifier la session : ${error.message}`);
    return;
  }
  if (passwordUpdateRequired) {
    if (data.session) {
      displayPasswordForm();
    } else {
      displayLogin(
        "Lien invalide ou expiré. Demandez un nouveau lien de réinitialisation.",
      );
    }
    return;
  }
  if (data.session) await showDashboard(data.session);
}

initialize().catch((error) =>
  showStatus(`Erreur d’initialisation : ${error.message}`, "error"),
);
