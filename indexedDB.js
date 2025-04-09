
const DB_NAME = "QueryDB";
const DB_VERSION = 2;

const STORE_NAME = "queries";

const CUSTOM_STORE_NAME = "customQueries";

function openDatabase() {
  return new Promise((resolve, reject) => {
    let request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      let db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        let store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("categoria", "categoria", { unique: false }); 
      } else {
        let store = event.target.transaction.objectStore(STORE_NAME);
        if (!store.indexNames.contains("categoria")) {
          store.createIndex("categoria", "categoria", { unique: false });
        }
      }

      if (!db.objectStoreNames.contains(CUSTOM_STORE_NAME)) {
        let customStore = db.createObjectStore(CUSTOM_STORE_NAME, {
          keyPath: "id",
          autoIncrement: true
        });
        customStore.createIndex("categoria", "categoria", { unique: false });
      } else {
        let customStore = event.target.transaction.objectStore(CUSTOM_STORE_NAME);
        if (!customStore.indexNames.contains("categoria")) {
          customStore.createIndex("categoria", "categoria", { unique: false });
        }
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Guarda (o actualiza) una query por defecto en IndexedDB.
 * @param {string} id - Identificador de la query (ej. "charges_payOrders")
 * @param {string} query - El texto SQL
 * @param {string} categoria
 */
async function saveQuery(id, query, categoria = "Sin Categoría") {
  let db = await openDatabase();
  let transaction = db.transaction(STORE_NAME, "readwrite");
  let store = transaction.objectStore(STORE_NAME);
  store.put({ id, query, categoria });
}

/**
 * Obtiene una query por defecto (store "queries") dada su ID.
 * @param {string} id
 * @returns {Promise<string|null>} - Retorna el contenido de la query, o null si no existe.
 */
async function getQuery(id) {
  let db = await openDatabase();
  let transaction = db.transaction(STORE_NAME, "readonly");
  let store = transaction.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    let request = store.get(id);
    request.onsuccess = () => {
      resolve(request.result ? request.result.query : null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Obtiene todas las queries almacenadas en el store "queries".
 * @returns {Promise<Array>} - Retorna un array de objetos {id, query, categoria}
 */
async function getAllQueries() {
  let db = await openDatabase();
  let transaction = db.transaction(STORE_NAME, "readonly");
  let store = transaction.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    let request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Inicializa la base de datos con las queries "default" predeterminadas.
 * Solo crea las que no existen; no sobrescribe las existentes.
 */
async function initializeDatabase() {
  let db = await openDatabase();
  let transaction = db.transaction(STORE_NAME, "readwrite");
  let store = transaction.objectStore(STORE_NAME);

  const DEFAULT_QUERIES = [
    {
      id: "charges_payOrders",
      categoria: "Billing (BE)",
      query: `
      `
    },
    {
      id: "charges_payOrders_transactions",
      categoria: "Billing (BE)",
      query: `
      `
    },
    {
      id: "payments_table",
      categoria: "Billing (BE)",
      query: `
      `
    },
    {
      id: "charges_table",
      categoria: "Billing (BE)",
      query: `
      `
    },
    {
      id: "plan_changes",
      categoria: "Billing (Core)",
      query: `
      `
    },
    {
      id: "payments_core",
      categoria: "Billing (Core)",
      query: `
      `
    }
  ];

  // Revisar si alguna de esas queries no existe y crearla.
  for (let defaultQuery of DEFAULT_QUERIES) {
    let request = store.get(defaultQuery.id);
    request.onsuccess = async () => {
      let existingQuery = request.result;

      if (!existingQuery) {
        await saveQuery(defaultQuery.id, defaultQuery.query, defaultQuery.categoria);
      } else if (!existingQuery.categoria) {
        existingQuery.categoria = defaultQuery.categoria;
        store.put(existingQuery);
      }
    };
  }
}

/**
 * Agrega una nueva query personalizada.
 * @param {Object} customQuery Objeto con la forma:
 *   {
 *     nombre: string,
 *     descripcion: string,
 *     url: string,
 *     parametros: string,
 *     query: string,
 *     categoria: string
 *   }
 * @returns {Promise<number>} - ID autogenerado
 */
async function addCustomQuery(customQuery) {
  let db = await openDatabase();
  return new Promise((resolve, reject) => {
    let transaction = db.transaction(CUSTOM_STORE_NAME, "readwrite");
    let store = transaction.objectStore(CUSTOM_STORE_NAME);

    if (typeof customQuery.categoria === "string") {
      let catTrim = customQuery.categoria.trim();
      customQuery.categoria = catTrim ? catTrim : "Personalizadas";
    } else {
      customQuery.categoria = "Personalizadas";
    }

    let request = store.add(customQuery);

    request.onsuccess = () => {
      console.log("✅ Query añadida correctamente con la categoría =>", customQuery.categoria);
      chrome.storage.local.set({ query_list_updated: Date.now() }); // Notificar actualización
      resolve(request.result);
    };
    request.onerror = (event) => {
      reject("Error al agregar la query personalizada: " + event.target.error);
    };
  });
}

/**
 * Obtiene todas las queries personalizadas.
 * @returns {Promise<Array>} - Array de objetos con todas las queries personalizadas.
 */
async function getAllCustomQueries() {
  let db = await openDatabase();
  return new Promise((resolve, reject) => {
    let transaction = db.transaction(CUSTOM_STORE_NAME, "readonly");
    let store = transaction.objectStore(CUSTOM_STORE_NAME);
    let request = store.getAll();

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    request.onerror = (event) => {
      reject("Error al obtener las queries personalizadas: " + event.target.error);
    };
  });
}

/**
 * Obtiene una query personalizada por ID numérico (keyPath autoIncrement).
 * @param {number} id 
 * @returns {Promise<Object|null>}
 */
async function getCustomQueryById(id) {
  let db = await openDatabase();
  return new Promise((resolve, reject) => {
    let transaction = db.transaction(CUSTOM_STORE_NAME, "readonly");
    let store = transaction.objectStore(CUSTOM_STORE_NAME);
    let request = store.get(id);

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    request.onerror = (event) => {
      reject("Error al obtener la query personalizada con ID " + id + ": " + event.target.error);
    };
  });
}

/**
 * Actualiza una query personalizada existente.
 * @param {Object} customQuery - Debe incluir `id` para identificar el registro.
 * @returns {Promise<boolean>} - true si se actualizó con éxito
 */
async function updateCustomQuery(customQuery) {
  if (!customQuery.id) {
    throw new Error("La query personalizada debe incluir un ID para poder actualizarse.");
  }
  let db = await openDatabase();
  return new Promise((resolve, reject) => {
    let transaction = db.transaction(CUSTOM_STORE_NAME, "readwrite");
    let store = transaction.objectStore(CUSTOM_STORE_NAME);
    let request = store.put(customQuery);

    request.onsuccess = () => {
      resolve(true);
    };
    request.onerror = (event) => {
      reject("Error al actualizar la query personalizada: " + event.target.error);
    };
  });
}

/**
 * Elimina una query personalizada por ID.
 * @param {number} id - ID de la query a eliminar.
 * @returns {Promise<boolean>} - true si se elimina con éxito
 */
async function deleteCustomQuery(id) {
  let db = await openDatabase();
  return new Promise((resolve, reject) => {
    let transaction = db.transaction(CUSTOM_STORE_NAME, "readwrite");
    let store = transaction.objectStore(CUSTOM_STORE_NAME);
    let request = store.delete(id);

    request.onsuccess = () => {
      console.log(`🗑️ Query ${id} eliminada.`);
      chrome.storage.local.set({ query_list_updated: Date.now() }); // Notificar actualización
      resolve(true);
    };
    request.onerror = (event) => {
      reject("Error al eliminar la query personalizada: " + event.target.error);
    };
  });
}

self.saveQuery = saveQuery;
self.getQuery = getQuery;
self.getAllQueries = getAllQueries;
self.initializeDatabase = initializeDatabase;

self.addCustomQuery = addCustomQuery;
self.getAllCustomQueries = getAllCustomQueries;
self.getCustomQueryById = getCustomQueryById;
self.updateCustomQuery = updateCustomQuery;
self.deleteCustomQuery = deleteCustomQuery;
