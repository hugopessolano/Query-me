/**********************************************
 * popup_add_query.js (con orden corregido)
 **********************************************/

document.addEventListener("DOMContentLoaded", async () => {
  // Referencias a los campos
  const btnAceptar = document.getElementById("btnAceptar");
  const btnCancelar = document.getElementById("btnCancelar");

  const paramInput = document.getElementById("parametros");
  const paramTagsContainer = document.getElementById("paramTagsContainer");
  const autocompleteContainer = document.getElementById("autocompleteContainer");

  const nombreInput = document.getElementById("nombre");
  const descripcionInput = document.getElementById("descripcion");
  const urlInput = document.getElementById("urlCampo");
  const categoriaInput = document.getElementById("categoriaCampo");

  // Arrays para tags
  let paramInputTags = [];
  let queryTags = [];

  // 1) Detectar si estamos en modo edición (por query string)
  const urlParams = new URLSearchParams(window.location.search);
  const isEditMode = urlParams.get("mode") === "edit";
  const editingId = isEditMode ? parseInt(urlParams.get("id"), 10) : null;

  // 2) Inicializar CodeMirror primero
  let editor = CodeMirror.fromTextArea(document.getElementById("query"), {
    mode: "text/x-sql",
    theme: "monokai",
    lineNumbers: true,
    lineWrapping: true
  });

  // Manejo de cambios en CodeMirror
  editor.on("change", () => {
    parseQueryTags();
    renderTags();
    showAutocompleteIfNeeded();
  });

  // Manejo de cursor/teclas en CodeMirror
  let activeSuggestionIndex = -1;
  editor.on("cursorActivity", () => showAutocompleteIfNeeded());
  editor.on("keydown", (cm, event) => {
    if (autocompleteContainer.style.display === "block") {
      let items = autocompleteContainer.querySelectorAll(".autocomplete-item");
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        moveActiveSuggestion(event.key === "ArrowUp" ? -1 : 1);
      } else if (event.key === "Tab" || event.key === "Enter") {
        if (items.length > 0) {
          event.preventDefault();
          let chosenIndex = activeSuggestionIndex < 0 ? 0 : activeSuggestionIndex;
          let chosenTag = items[chosenIndex].dataset.tag;
          insertAutocompleteTag(chosenTag);
        }
      } else if (event.key === "Escape") {
        event.preventDefault();
        hideAutocomplete();
      }
    }
  });

  // 3) Si estamos en modo edición, cargar la query desde IndexedDB y rellenar campos
  if (isEditMode && editingId) {
    try {
      const data = await chrome.runtime.sendMessage({ type: "GET_ALL_CUSTOM_QUERIES" });
      if (data && data.success) {
        const found = data.queries.find(q => q.id === editingId);
        if (!found) {
          alert("No se encontró la query a editar con ID=" + editingId);
        } else {
          // Rellenar campos
          nombreInput.value = found.nombre || "";
          descripcionInput.value = found.descripcion || "";
          urlInput.value = found.url || "";
          categoriaInput.value = found.categoria || "";

          // Parametros
          paramInputTags = found.parametros ? found.parametros.split(",") : [];

          // Query
          editor.setValue(found.query || "");

          // Refrescar tags
          parseQueryTags(); 
          renderTags();
        }
      }
    } catch (err) {
      console.error("Error cargando query a editar:", err);
      alert("No se pudo cargar la query para editar.");
    }
  }

  // 4) Manejo del input de parámetros (crear tags con SPACE)
  paramInput.addEventListener("keydown", (event) => {
    if (event.key === " ") {
      const text = paramInput.value.trim();
      if (text.length > 0 && !paramInputTags.includes(text)) {
        paramInputTags.push(text);
      }
      paramInput.value = "";
      event.preventDefault();
      renderTags();
    }
  });

  // 5) Funciones para parsear y renderizar tags
  function parseQueryTags() {
    const content = editor.getValue();
    const regex = /\{([^}]+)\}/g;
    let match;
    let newQueryTags = [];
    while ((match = regex.exec(content)) !== null) {
      const inside = match[1].trim();
      if (inside && !newQueryTags.includes(inside)) {
        newQueryTags.push(inside);
      }
    }
    queryTags = newQueryTags;
  }

  function renderTags() {
    paramTagsContainer.innerHTML = "";

    let allTags = [...paramInputTags];
    queryTags.forEach(tag => {
      if (!allTags.includes(tag)) {
        allTags.push(tag);
      }
    });

    allTags.forEach(tag => {
      let origin = queryTags.includes(tag) && !paramInputTags.includes(tag)
                   ? "query" : "paramInput";
      const tagEl = document.createElement("span");
      tagEl.classList.add("tag");
      tagEl.dataset.origin = origin;
      tagEl.textContent = tag;

      const closeBtn = document.createElement("span");
      closeBtn.classList.add("close-btn");
      closeBtn.textContent = "x";
      closeBtn.addEventListener("click", () => handleRemoveTag(tag, origin));
      tagEl.appendChild(closeBtn);

      paramTagsContainer.appendChild(tagEl);
    });
  }

  function handleRemoveTag(tag, origin) {
    if (origin === "paramInput") {
      paramInputTags = paramInputTags.filter(t => t !== tag);
      renderTags();
    } else {
      alert("Tag proveniente de la Query. Modifícalo/elimínalo dentro de { } en CodeMirror.");
    }
  }

  // 6) Autocompletado
  function showAutocompleteIfNeeded() {
    activeSuggestionIndex = -1;

    let cursor = editor.getCursor();
    let text = editor.getValue();
    let posIndex = editor.indexFromPos(cursor);

    let openBraceIndex = text.lastIndexOf('{', posIndex - 1);
    let closeBraceIndex = text.lastIndexOf('}', posIndex - 1);

    if (openBraceIndex === -1 || closeBraceIndex > openBraceIndex) {
      hideAutocomplete();
      return;
    }

    let partial = text.substring(openBraceIndex + 1, posIndex).trim();
    let allExistingTags = [...new Set([...paramInputTags, ...queryTags])];
    let suggestions = allExistingTags.filter(tag =>
      tag.toLowerCase().startsWith(partial.toLowerCase())
    );
    if (!partial) {
      suggestions = allExistingTags;
    }
    if (!suggestions.length) {
      hideAutocomplete();
      return;
    }

    showSuggestions(suggestions, partial);
    updateAutocompletePosition();
  }

  function showSuggestions(suggestions, partial) {
    autocompleteContainer.innerHTML = "";
    suggestions.forEach((sug) => {
      let item = document.createElement("div");
      item.classList.add("autocomplete-item");
      item.dataset.tag = sug;

      let regex = new RegExp(`^(${partial})`, "i");
      let highlighted = sug.replace(regex, (match) => {
        return `<span class="autocomplete-match">${match}</span>`;
      });
      item.innerHTML = highlighted;

      item.addEventListener("click", () => {
        insertAutocompleteTag(sug);
      });

      autocompleteContainer.appendChild(item);
    });
    autocompleteContainer.style.display = "block";
  }

  function hideAutocomplete() {
    autocompleteContainer.style.display = "none";
    autocompleteContainer.innerHTML = "";
    activeSuggestionIndex = -1;
  }

  function moveActiveSuggestion(delta) {
    let items = autocompleteContainer.querySelectorAll(".autocomplete-item");
    if (!items.length) return;

    if (activeSuggestionIndex >= 0 && activeSuggestionIndex < items.length) {
      items[activeSuggestionIndex].classList.remove("active");
    }
    activeSuggestionIndex += delta;

    if (activeSuggestionIndex < 0) {
      activeSuggestionIndex = items.length - 1;
    } else if (activeSuggestionIndex >= items.length) {
      activeSuggestionIndex = 0;
    }
    items[activeSuggestionIndex].classList.add("active");
  }

  function insertAutocompleteTag(chosenTag) {
    let cursor = editor.getCursor();
    let text = editor.getValue();
    let posIndex = editor.indexFromPos(cursor);

    let openBraceIndex = text.lastIndexOf('{', posIndex - 1);
    let before = text.substring(0, openBraceIndex + 1);
    let after = text.substring(posIndex);

    let newText = before + chosenTag + after;
    if (!after.startsWith('}')) {
      newText = before + chosenTag + '}' + after;
    }

    editor.setValue(newText);

    let newCaretPos = (openBraceIndex + 1) + chosenTag.length;
    if (!after.startsWith('}')) {
      newCaretPos++;
    }
    let newCursor = editor.posFromIndex(newCaretPos);
    editor.setCursor(newCursor);

    hideAutocomplete();
    editor.focus();
    parseQueryTags();
    renderTags();
  }

  function updateAutocompletePosition() {
    let cmWrapper = editor.getWrapperElement();
    let rect = cmWrapper.getBoundingClientRect();
    let scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    let top = rect.bottom + scrollTop;
    let left = rect.left;

    autocompleteContainer.style.top = top + "px";
    autocompleteContainer.style.left = left + "px";
    autocompleteContainer.style.width = rect.width + "px";
  }

  // 7) Botones ACEPTAR / CANCELAR
  btnAceptar.addEventListener("click", () => {
    let nombre = nombreInput.value.trim();
    let descripcion = descripcionInput.value.trim();
    let url = urlInput.value.trim();
    let parametros = paramInputTags.join(",");
    let finalQuery = editor.getValue();
    let categoria = categoriaInput.value.trim();

    if (!isEditMode) {
      // GUARDAR NUEVA
      chrome.runtime.sendMessage(
        {
          type: "SAVE_CUSTOM_QUERY",
          payload: { nombre, descripcion, url, parametros, query: finalQuery, categoria }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn("lastError:", chrome.runtime.lastError.message);
            alert("Error comunicando con el background. Revisa la consola.");
            return;
          }
          if (!response) {
            alert("No hubo respuesta del background.");
            return;
          }
          if (!response.success) {
            if (response.reason === "DUPLICATE_NAME") {
              alert("Ya existe una query con ese nombre. Por favor, cámbialo.");
            } else if (response.reason === "INSERT_FAILED") {
              alert("Ocurrió un error al guardar la query. Intenta de nuevo.");
            } else {
              alert("Error desconocido: " + response.reason);
            }
            return;
          }
          showTemporaryMessage("Query guardada correctamente!");
        }
      );
    } else {
      // ACTUALIZAR EXISTENTE
      chrome.runtime.sendMessage(
        {
          type: "UPDATE_CUSTOM_QUERY",
          payload: {
            id: editingId,
            nombre,
            descripcion,
            url,
            parametros,
            query: finalQuery,
            categoria
          }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn("lastError:", chrome.runtime.lastError.message);
            alert("Error comunicando con el background. Revisa la consola.");
            return;
          }
          if (!response) {
            alert("No hubo respuesta del background.");
            return;
          }
          if (!response.success) {
            if (response.reason === "DUPLICATE_NAME") {
              alert("Ya existe otra query con ese nombre. Por favor, cámbialo.");
            } else {
              alert("Error al actualizar: " + response.reason);
            }
            return;
          }
          showTemporaryMessage("Query actualizada correctamente!");
        }
      );
    }
  });

  btnCancelar.addEventListener("click", () => {
    window.close();
  });

  function showTemporaryMessage(message) {
    let msgDiv = document.createElement("div");
    msgDiv.textContent = message;
    msgDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #333;
      color: #fff;
      padding: 16px 24px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 999999;
    `;
    document.body.appendChild(msgDiv);

    setTimeout(() => {
      msgDiv.remove();
      setTimeout(() => {
        window.close();
      }, 200);
    }, 1000);
  }
});
