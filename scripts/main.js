const MODULE_ID = "token-appearance-changer";
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i;
const VIDEO_EXT = /\.(webm|mp4|m4v|ogv)$/i;
const GALLERY_LIMIT = 60;

/* -------------------------------------------- */
/*  Compatibility helpers (Foundry v12 / v13)   */
/* -------------------------------------------- */

function getFilePicker() {
  return foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function colorToHex(color) {
  if (!color && color !== 0) return "#ffffff";
  if (typeof color === "string") return color;
  return color.css ?? `#${Number(color).toString(16).padStart(6, "0")}`;
}

/* -------------------------------------------- */
/*  Token HUD button                            */
/* -------------------------------------------- */

Hooks.on("renderTokenHUD", (hud, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const doc = hud.document ?? hud.object?.document;
  if (!root || !doc?.isOwner) return;

  const column = root.querySelector(".col.right");
  if (!column || column.querySelector(".tac-hud-button")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("control-icon", "tac-hud-button");
  button.dataset.tooltip = game.i18n.localize("TAC.HudButton");
  button.setAttribute("aria-label", game.i18n.localize("TAC.HudButton"));
  button.innerHTML = `<i class="fa-solid fa-palette"></i>`;
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    hud.close?.();
    openAppearanceDialog(doc);
  });
  column.append(button);
});

/* -------------------------------------------- */
/*  Dialog                                      */
/* -------------------------------------------- */

async function openAppearanceDialog(doc) {
  const { DialogV2 } = foundry.applications.api;
  const canUpdatePrototype = !!doc.actor?.isOwner;

  const result = await DialogV2.wait({
    window: {
      title: game.i18n.format("TAC.Title", { name: doc.name }),
      icon: "fa-solid fa-palette"
    },
    classes: ["tac-dialog"],
    position: { width: 520 },
    content: buildContent(doc, canUpdatePrototype),
    buttons: [
      {
        action: "apply",
        label: "TAC.Apply",
        icon: "fa-solid fa-check",
        default: true,
        callback: (event, button) => readForm(button.form)
      },
      {
        action: "reset",
        label: "TAC.Reset",
        icon: "fa-solid fa-rotate-left",
        callback: () => "reset"
      },
      {
        action: "cancel",
        label: "TAC.Cancel",
        icon: "fa-solid fa-xmark"
      }
    ],
    render: (event, app) => activateListeners(app instanceof HTMLElement ? app : app.element),
    rejectClose: false
  });

  if (result === "reset") return resetToPrototype(doc);
  if (result && typeof result === "object") return applyAppearance(doc, result);
}

function buildContent(doc, canUpdatePrototype) {
  const t = doc.texture;
  const scaleX = t.scaleX ?? 1;
  const scaleY = t.scaleY ?? 1;
  const alpha = doc.alpha ?? 1;
  const i18n = key => game.i18n.localize(key);

  return `
    <div class="tac-layout">
      <div class="tac-preview">
        <img src="${escapeHTML(t.src)}" alt="">
      </div>
      <div class="tac-fields">
        <div class="form-group">
          <label>${i18n("TAC.Image")}</label>
          <div class="form-fields">
            <input type="text" name="src" value="${escapeHTML(t.src)}">
            <button type="button" class="tac-browse" data-tooltip="${i18n("TAC.Browse")}">
              <i class="fa-solid fa-file-import"></i>
            </button>
          </div>
        </div>
        <div class="form-group">
          <label>${i18n("TAC.Tint")}</label>
          <div class="form-fields">
            <input type="color" name="tint" value="${colorToHex(t.tint)}">
          </div>
        </div>
        <div class="form-group">
          <label>${i18n("TAC.Alpha")}</label>
          <div class="form-fields">
            <input type="range" name="alpha" min="0" max="1" step="0.05" value="${alpha}">
            <span class="tac-range-value">${alpha}</span>
          </div>
        </div>
        <div class="form-group">
          <label>${i18n("TAC.Scale")}</label>
          <div class="form-fields">
            <input type="number" name="scale" min="0.1" max="5" step="0.05" value="${Math.abs(scaleX)}">
          </div>
        </div>
        <div class="form-group">
          <label>${i18n("TAC.MirrorX")}</label>
          <div class="form-fields">
            <input type="checkbox" name="mirrorX" ${scaleX < 0 ? "checked" : ""}>
          </div>
        </div>
        <div class="form-group">
          <label>${i18n("TAC.MirrorY")}</label>
          <div class="form-fields">
            <input type="checkbox" name="mirrorY" ${scaleY < 0 ? "checked" : ""}>
          </div>
        </div>
        <div class="form-group">
          <label>${i18n("TAC.Width")}</label>
          <div class="form-fields">
            <input type="number" name="width" min="0.5" step="0.5" value="${doc.width}">
          </div>
        </div>
        <div class="form-group">
          <label>${i18n("TAC.Height")}</label>
          <div class="form-fields">
            <input type="number" name="height" min="0.5" step="0.5" value="${doc.height}">
          </div>
        </div>
        ${canUpdatePrototype ? `
        <div class="form-group">
          <label>${i18n("TAC.UpdatePrototype")}</label>
          <div class="form-fields">
            <input type="checkbox" name="updatePrototype">
          </div>
        </div>` : ""}
      </div>
    </div>
    <fieldset class="tac-gallery-wrapper" hidden>
      <legend>${i18n("TAC.Gallery")}</legend>
      <div class="tac-gallery"></div>
    </fieldset>`;
}

function readForm(form) {
  const field = name => form.elements.namedItem(name);
  const scale = Math.max(0.1, Number(field("scale").value) || 1);
  return {
    src: field("src").value.trim(),
    tint: field("tint").value,
    alpha: Math.clamp(Number(field("alpha").value), 0, 1),
    scaleX: scale * (field("mirrorX").checked ? -1 : 1),
    scaleY: scale * (field("mirrorY").checked ? -1 : 1),
    width: Math.max(0.5, Number(field("width").value) || 1),
    height: Math.max(0.5, Number(field("height").value) || 1),
    updatePrototype: field("updatePrototype")?.checked ?? false
  };
}

/* -------------------------------------------- */
/*  Dialog interactivity                        */
/* -------------------------------------------- */

function activateListeners(element) {
  if (!element) return;
  const srcInput = element.querySelector("input[name=src]");
  const alphaInput = element.querySelector("input[name=alpha]");
  const alphaValue = element.querySelector(".tac-range-value");
  const mirrorX = element.querySelector("input[name=mirrorX]");
  const mirrorY = element.querySelector("input[name=mirrorY]");
  const preview = element.querySelector(".tac-preview img");

  const updatePreview = () => {
    const src = srcInput.value.trim();
    preview.hidden = !src || VIDEO_EXT.test(src);
    if (!preview.hidden) preview.src = src;
    preview.style.opacity = alphaInput.value;
    preview.style.transform = `scale(${mirrorX.checked ? -1 : 1}, ${mirrorY.checked ? -1 : 1})`;
    alphaValue.textContent = alphaInput.value;
  };

  const setSource = path => {
    srcInput.value = path;
    updatePreview();
    renderGallery(element, path, setSource);
  };

  srcInput.addEventListener("change", () => setSource(srcInput.value.trim()));
  alphaInput.addEventListener("input", updatePreview);
  mirrorX.addEventListener("change", updatePreview);
  mirrorY.addEventListener("change", updatePreview);

  element.querySelector(".tac-browse").addEventListener("click", event => {
    event.preventDefault();
    const FP = getFilePicker();
    new FP({
      type: "imagevideo",
      current: srcInput.value,
      callback: path => setSource(path)
    }).render(true);
  });

  updatePreview();
  renderGallery(element, srcInput.value, setSource);
}

/**
 * Show thumbnails of other images in the same folder as the current image,
 * so alternative token art can be picked with a single click.
 */
async function renderGallery(element, src, onSelect) {
  const wrapper = element.querySelector(".tac-gallery-wrapper");
  const gallery = element.querySelector(".tac-gallery");
  if (!wrapper || !gallery) return;

  const slash = src?.lastIndexOf("/") ?? -1;
  if (!game.user.can("FILES_BROWSE") || slash < 0 || /^https?:/i.test(src)) {
    wrapper.hidden = true;
    return;
  }

  const directory = src.slice(0, slash);
  const source = directory.startsWith("icons") ? "public" : "data";
  let files = [];
  try {
    const result = await getFilePicker().browse(source, directory);
    files = result.files.filter(f => IMAGE_EXT.test(f)).slice(0, GALLERY_LIMIT);
  } catch (err) {
    console.warn(`${MODULE_ID} | Could not browse ${directory}`, err);
    wrapper.hidden = true;
    return;
  }

  wrapper.hidden = false;
  gallery.replaceChildren();
  if (!files.length) {
    gallery.textContent = game.i18n.localize("TAC.GalleryEmpty");
    return;
  }

  for (const file of files) {
    const img = document.createElement("img");
    img.src = file;
    img.loading = "lazy";
    img.dataset.tooltip = decodeURIComponent(file.split("/").pop());
    if (decodeURIComponent(file) === decodeURIComponent(src)) img.classList.add("active");
    img.addEventListener("click", () => onSelect(file));
    gallery.append(img);
  }
}

/* -------------------------------------------- */
/*  Updates                                     */
/* -------------------------------------------- */

async function applyAppearance(doc, data) {
  if (!data.src) return ui.notifications.warn(game.i18n.localize("TAC.NoImage"));

  const update = {
    "texture.src": data.src,
    "texture.tint": data.tint,
    "texture.scaleX": data.scaleX,
    "texture.scaleY": data.scaleY,
    alpha: data.alpha,
    width: data.width,
    height: data.height
  };
  await doc.update(update);

  if (data.updatePrototype && doc.actor) {
    const prototypeUpdate = Object.fromEntries(
      Object.entries(update).map(([key, value]) => [`prototypeToken.${key}`, value])
    );
    await doc.actor.update(prototypeUpdate);
  }

  ui.notifications.info(game.i18n.format("TAC.Updated", { name: doc.name }));
}

async function resetToPrototype(doc) {
  const proto = doc.actor?.prototypeToken;
  if (!proto) return ui.notifications.warn(game.i18n.localize("TAC.NoPrototype"));

  const update = {
    "texture.tint": proto.texture.tint,
    "texture.scaleX": proto.texture.scaleX,
    "texture.scaleY": proto.texture.scaleY,
    alpha: proto.alpha,
    width: proto.width,
    height: proto.height
  };
  // Wildcard paths (e.g. "tokens/goblin*.png") are not valid for placed tokens.
  if (!proto.texture.src?.includes("*")) update["texture.src"] = proto.texture.src;

  await doc.update(update);
  ui.notifications.info(game.i18n.format("TAC.Updated", { name: doc.name }));
}
