/**********************************************
 * query_admin.js (Rediseñado en modo "cards")
 **********************************************/

document.addEventListener("DOMContentLoaded", async () => {
  const addBtn = document.getElementById("btnAddQuery");
  if (addBtn && typeof openAddQueryPopup === "function") {
    addBtn.addEventListener("click", () => openAddQueryPopup()); // alta normal
  }

  // Carga inicial de queries
  loadQueries();

  // Recargar cuando se actualice 'query_list_updated' en chrome.storage
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.query_list_updated) {
      loadQueries();
    }
  });
});

async function loadQueries() {
  const queriesList = document.getElementById("queriesList");
  const toastContainer = document.getElementById("toastContainer");

  queriesList.innerHTML = "<div style='text-align:center; padding: 15px;'>Cargando queries...</div>";

  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_ALL_CUSTOM_QUERIES" });
    if (!response || !response.success) {
      queriesList.innerHTML = "<div style='text-align:center; color:red; padding:15px;'>Error al cargar queries.</div>";
      return;
    }

    const queries = response.queries || [];
    if (queries.length === 0) {
      queriesList.innerHTML = "<div style='text-align:center; padding:15px;'>No hay queries personalizadas almacenadas.</div>";
      return;
    }

    queriesList.innerHTML = ""; // limpiar

    queries.forEach(q => {
      const card = document.createElement("div");
      card.classList.add("query-card");

      // ----- HEADER -----
      const header = document.createElement("div");
      header.classList.add("query-card-header");

      const title = document.createElement("div");
      title.classList.add("query-card-title");
      title.textContent = q.nombre || "(Sin nombre)";

      const toggleIcon = document.createElement("span");
      toggleIcon.classList.add("query-card-toggle");
      toggleIcon.textContent = "▼";

      header.appendChild(title);
      header.appendChild(toggleIcon);

      // ----- DETALLES (colapsables) -----
      const details = document.createElement("div");
      details.classList.add("query-card-details");
      details.style.display = "none";

      // Descripción
      const descRow = document.createElement("div");
      descRow.classList.add("query-details-row");
      descRow.innerHTML = `<span class="detail-label">Descripción:</span> ${q.descripcion || ""}`;
      details.appendChild(descRow);

      // URL
      const urlRow = document.createElement("div");
      urlRow.classList.add("query-details-row");
      urlRow.innerHTML = `<span class="detail-label">URL:</span> ${q.url || ""}`;
      details.appendChild(urlRow);

      // Categoría
      const catRow = document.createElement("div");
      catRow.classList.add("query-details-row");
      catRow.innerHTML = `<span class="detail-label">Categoría:</span> ${q.categoria || "Personalizadas"}`;
      details.appendChild(catRow);

      // Parámetros (tags)
      const paramsRow = document.createElement("div");
      paramsRow.classList.add("query-details-row");
      paramsRow.innerHTML = `<span class="detail-label">Parámetros:</span>`;
      const tagsContainer = document.createElement("div");
      tagsContainer.classList.add("tags-container");

      if (q.parametros && q.parametros.trim() !== "") {
        const paramList = q.parametros.split(",");
        paramList.forEach(tagText => {
          const tag = document.createElement("span");
          tag.classList.add("tag");
          tag.textContent = tagText.trim();
          tagsContainer.appendChild(tag);
        });
      }
      paramsRow.appendChild(tagsContainer);
      details.appendChild(paramsRow);

      // Query (contenido CodeMirror en modo lectura)
      const queryCodeRow = document.createElement("div");
      queryCodeRow.classList.add("query-details-row", "query-code-container");
      const textArea = document.createElement("textarea");
      textArea.value = q.query || "—";
      queryCodeRow.appendChild(textArea);
      details.appendChild(queryCodeRow);

      // ----- BOTONES -----
      const actions = document.createElement("div");
      actions.classList.add("action-buttons");

      // Botón EDITAR
      const btnEdit = document.createElement("button");
      btnEdit.classList.add("action-button", "edit");
      btnEdit.textContent = "Editar";
      btnEdit.addEventListener("click", () => {
        // Abre popup_add_query.html con modo=edit e id
        // Para reutilizar la misma UI con datos cargados
        chrome.windows.create({
          url: `popup_add_query.html?mode=edit&id=${q.id}`,
          type: "popup",
          width: 600,
          height: 600,
          focused: true
        });
      });

      // Botón ELIMINAR
      const btnDelete = document.createElement("button");
      btnDelete.classList.add("action-button", "delete");
      btnDelete.textContent = "Eliminar";
      btnDelete.addEventListener("click", async () => {
        if (confirm("¿Seguro que deseas eliminar esta query?")) {
          try {
            const delResponse = await chrome.runtime.sendMessage({
              type: "DELETE_CUSTOM_QUERY",
              id: q.id
            });
            if (delResponse && delResponse.success) {
              showToast("¡Query eliminada con éxito!");
              loadQueries(); 
            } else {
              showToast("Error al eliminar la query.");
            }
          } catch (error) {
            console.error("Error eliminando query:", error);
            showToast("Error interno al eliminar.");
          }
        }
      });

      actions.appendChild(btnEdit);
      actions.appendChild(btnDelete);
      details.appendChild(actions);

      // Evento click en el header => togglear details
      header.addEventListener("click", () => {
        const isExpanded = (details.style.display === "block");
        details.style.display = isExpanded ? "none" : "block";
        toggleIcon.classList.toggle("expanded");
      });

      // Armado final
      card.appendChild(header);
      card.appendChild(details);
      queriesList.appendChild(card);

      // Iniciar CodeMirror en modo lectura
      setTimeout(() => {
        const cmInstance = CodeMirror.fromTextArea(textArea, {
          mode: "text/x-sql",
          theme: "monokai",
          lineNumbers: false,
          readOnly: true,
          lineWrapping: true
        });
        cmInstance.setSize("100%", "80px");
      }, 0);
    });
  } catch (error) {
    console.error("Error cargando queries:", error);
    queriesList.innerHTML = "<div style='text-align:center; color:red; padding:15px;'>Error interno al cargar queries.</div>";
  }

  function showToast(message) {
    const toastEl = document.createElement("div");
    toastEl.classList.add("toast");
    toastEl.textContent = message;
    toastContainer.appendChild(toastEl);
    setTimeout(() => { toastEl.remove(); }, 3000);
  }
}
