/**********************************************
 * menu_all_queries.js
 **********************************************/

const ALL_QUERIES_MENU_ID = "all_queries";
let allQueryIds = [];

/**
 * Crea la opción "Todas las queries" DENTRO de nuestro menú "queryMe" (en un solo nivel).
 */
function createAllQueriesMenu() {
  // Intentamos remover si ya existía un menú con id "all_queries"
  chrome.contextMenus.remove(ALL_QUERIES_MENU_ID, () => {
    if (chrome.runtime.lastError) {
      console.warn("⚠️ No se encontró el menú 'Todas las queries' para remover (puede ser normal).");
    }

    // Crear la sub-opción "Todas las queries" como hija de "queryMe"
    chrome.contextMenus.create({
      id: ALL_QUERIES_MENU_ID,
      parentId: "queryMe",
      title: "Todas las queries",
      contexts: ["all"]
    }, async () => {
      if (chrome.runtime.lastError) {
        console.error("❌ Error creando 'Todas las queries':", chrome.runtime.lastError);
      } else {
        console.log("✅ Submenú 'Todas las queries' creado dentro de 'Query Me!'.");
        await populateAllQueriesMenu();
      }
    });
  });
}

/**
 * Elimina todas las sub-opciones de "Todas las queries" antes de volver a crearlas.
 */
async function removeOldQueryMenus() {
  allQueryIds.forEach(menuId => {
    chrome.contextMenus.remove(menuId, () => {
      if (chrome.runtime.lastError) {
        console.warn(`⚠️ No se pudo eliminar '${menuId}':`, chrome.runtime.lastError);
      }
    });
  });
  allQueryIds = [];
}

/**
 * Obtiene todas las queries (default + personalizadas) y las agrega al submenú "Todas las queries",
 * agrupadas por su propiedad "categoria".
 */
async function populateAllQueriesMenu() {
  await removeOldQueryMenus(); // Primero limpiar submenús anteriores

  try {
    // Obtener queries por defecto e índice
    const defaultQueries = await getAllQueries();      // from store "queries"
    const customQueries = await getAllCustomQueries(); // from store "customQueries"
    const allQueries = [...defaultQueries, ...customQueries];

    if (allQueries.length === 0) {
      console.warn("⚠️ No hay queries almacenadas en absoluto.");
      return;
    }

    // Agrupar por categoría
    let categories = {};
    let createdCategories = new Set(); 

    allQueries.forEach(q => {
      let categoria = q.categoria ? q.categoria.trim() : "Sin Categoría";
      if (!categories[categoria]) {
        categories[categoria] = [];
      }
      categories[categoria].push(q);
    });

    // Crear submenús por categoría dentro de "all_queries"
    Object.keys(categories).forEach(categoria => {
      let categoryMenuId = `cat_${categoria.replace(/\s+/g, "_").toLowerCase()}`;

      if (!createdCategories.has(categoryMenuId)) {
        chrome.contextMenus.create({
          id: categoryMenuId,
          parentId: ALL_QUERIES_MENU_ID,
          title: categoria,
          contexts: ["all"]
        });
        createdCategories.add(categoryMenuId);
        allQueryIds.push(categoryMenuId);
      }

      // Crear items por cada query dentro de la categoría
      categories[categoria].forEach(q => {
        let menuId = `all_query_${q.id}`;
        if (!allQueryIds.includes(menuId)) {
          chrome.contextMenus.create({
            id: menuId,
            parentId: categoryMenuId,
            title: q.nombre || `Query ${q.id}`,
            contexts: ["all"]
          });
          allQueryIds.push(menuId);
        }
      });
    });

    console.log("✅ 'Todas las queries' actualizado con sus categorías.");
  } catch (error) {
    console.error("❌ Error al poblar todas las queries:", error);
  }
}

/**
 * Manejo de clics en el submenú "Todas las queries".
 * Copiamos la query correspondiente al portapapeles.
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId.startsWith("all_query_")) {
    let queryId = info.menuItemId.replace("all_query_", "");

    // Intentar primero en las “default”:
    let queryObj = await getQuery(queryId);
    if (!queryObj) {
      // Sino, buscar en las personalizadas
      const customObj = await getCustomQueryById(Number(queryId));
      if (!customObj) {
        console.error(`❌ No se encontró la query con ID: ${queryId}`);
        return;
      }
      queryObj = customObj.query; // Extraemos la propiedad query
    }

    copyQueryString(queryObj, tab.id, tab.url); // Reusa la función de background
  }
});

/** 
 * IMPORTANTE:
 *  Ya NO registramos createAllQueriesMenu() en onInstalled/onStartup aquí,
 *  porque ahora se invoca explícitamente desde background.js 
 */
// chrome.runtime.onInstalled.addListener(createAllQueriesMenu);
// chrome.runtime.onStartup.addListener(createAllQueriesMenu);
