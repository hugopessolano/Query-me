
importScripts("indexedDB.js", "menu_all_queries.js");
importScripts("popup_manager.js"); 

let activeTab = "other";
let activeSubTab = "none";


let planChangesItemCreated = false;
let customQueryIds = []; 

console.log("✅ Background script cargado correctamente.");

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.query_list_updated) {
        console.log("🔄 Detectado cambio en queries. Actualizando menú (todas las queries)...");
        populateAllQueriesMenu(); 
    }
});


function createBaseMenu(callback) {
    chrome.contextMenus.remove("queryMe", () => {
        chrome.contextMenus.create({
            id: "queryMe",
            title: "Query Me!",
            contexts: ["all"]
        }, () => {

            chrome.contextMenus.create({
                id: "custom_queries_personalizadas",
                parentId: "queryMe",
                title: "Queries Personalizadas",
                contexts: ["all"]
            });

            chrome.contextMenus.create({
                id: "manage_queries",
                parentId: "custom_queries_personalizadas",
                title: "Administrar Queries",
                contexts: ["all"]
            });

            getAllCustomQueries().then(customQueries => {
                customQueries.forEach(cq => {
                    let docPattern = normalizeDocumentUrlPattern(cq.url);
                    chrome.contextMenus.create({
                        id: `custom_dynamic_${cq.id}`,
                        parentId: "custom_queries_personalizadas",
                        title: cq.nombre || `Query #${cq.id}`,
                        contexts: ["all"],
                        documentUrlPatterns: [docPattern]
                    }, () => {
                        if (chrome.runtime.lastError) {
                            console.warn(`⚠️ No se pudo crear menú para query ${cq.id}:`, chrome.runtime.lastError);
                        }
                    });
                });
            }).catch(err => {
                console.error("❌ Error al cargar customQueries:", err);
            });

            if (activeTab === "billingengine") {
                createBillingEngineQueries();
            } else if (activeTab === "paymentsCore") {
                createPaymentsCoreQuery();
            }

            if (planChangesItemCreated) {
                createPlanChangesQuery();
            }

            createAllQueriesMenu();

            if (typeof callback === "function") callback();
        });
    });
}

async function createBillingEngineQueries() {
    try {
        await initializeDatabase();
        let queries = await getAllQueries();
        if (!queries || queries.length === 0) return;

        const renamedQueries = {
            "charges_payOrders": "Query - Charges / payOrders",
            "charges_payOrders_transactions": "Query - Charges / payOrders / paymentTransactions",
            "charges_table": "Query - Charges table (Billing)",
            "payments_table": "Query - Payments table (Billing)"
        };

        queries.forEach(q => {
            if (q.id === "plan_changes" || q.id === "payments_core") return;

            let displayName = renamedQueries[q.id] || `Query: ${q.id.replace(/_/g, " ").toUpperCase()}`;

            if (
                (q.id === "payments_table" && activeSubTab !== "payments") ||
                (q.id === "charges_table" && activeSubTab !== "charges")
            ) return;

            chrome.contextMenus.create({
                id: `custom_${q.id}`,
                parentId: "queryMe",
                title: displayName,
                contexts: ["all"],
                documentUrlPatterns: ["https://stats.tiendanube.com/store/profile?store_id=*"]
            });
        });
    } catch (error) {
        console.error("❌ Error en createBillingEngineQueries:", error);
    }
}

function createPaymentsCoreQuery() {
    chrome.contextMenus.create({
        id: "custom_payments_core",
        parentId: "queryMe",
        title: "Query - Payments (Core)",
        contexts: ["all"],
        documentUrlPatterns: ["https://stats.tiendanube.com/store/profile?store_id=*"]
    });
}

function createPlanChangesQuery() {
    chrome.contextMenus.create({
        id: "custom_plan_changes",
        parentId: "queryMe",
        title: "Query - Cambios de plan",
        contexts: ["all"],
        documentUrlPatterns: ["https://stats.tiendanube.com/store/profile?store_id=*"]
    });
}

function normalizeDocumentUrlPattern(userInput) {
   if (!userInput || !userInput.trim()) {
       return "<all_urls>";
   }

   let trimmed = userInput.trim();

   if (trimmed.includes("*")) {
       return trimmed;
   }

   try {
       const url = new URL(trimmed);
       let pattern = `${url.origin}${url.pathname}`;
       if (url.search) {
           pattern += `?${url.searchParams.toString()}`;
       }
       return pattern;

   } catch (e) {
       let p = trimmed;
       if (!p.includes("://")) {
           p = `*://${p}`;
       }
       if (!p.endsWith("*")) {
           p += "*";
       }
       return p;
   }
}

async function updateContextMenu() {
    await removeExistingCustomQueries();

    createBaseMenu(async () => {
        try {
            const customQueries = await getAllCustomQueries();
            customQueries.forEach(cq => {
                const menuId = `custom_dynamic_${cq.id}`;
                customQueryIds.push(menuId);

                let docPattern = normalizeDocumentUrlPattern(cq.url);
                chrome.contextMenus.create({
                    id: menuId,
                    parentId: "custom_queries_personalizadas",
                    title: cq.nombre || `Query #${cq.id}`,
                    contexts: ["all"],
                    documentUrlPatterns: [docPattern]
                }, () => {
                    if (chrome.runtime.lastError) {
                        console.warn(`⚠️ Error creando '${menuId}':`, chrome.runtime.lastError);
                    }
                });
            });
        } catch (err) {
            console.error("❌ Error al cargar customQueries:", err);
        }
    });
}
async function removeExistingCustomQueries() {
    return new Promise((resolve) => {
        customQueryIds.forEach(menuId => {
            chrome.contextMenus.remove(menuId, () => {
                if (chrome.runtime.lastError) {
                    console.warn(`⚠️ No se pudo eliminar '${menuId}':`, chrome.runtime.lastError);
                }
            });
        });
        customQueryIds = [];
        resolve();
    });
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "UPDATE_ACTIVE_TAB") {
        activeTab = message.activeTab;
        activeSubTab = message.activeSubTab || "none";

        if (message.planChanges && !planChangesItemCreated) {
            planChangesItemCreated = true;
            createPlanChangesQuery();
        } 
        else if (!message.planChanges && planChangesItemCreated) {
            planChangesItemCreated = false;
            chrome.contextMenus.remove("custom_plan_changes", () => {
                console.log("❌ Se quitó la opción de Cambios de plan");
            });
        }

        updateContextMenu();
    }
});

chrome.runtime.onInstalled.addListener(async () => {
    await initializeDatabase();
    updateContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
    updateContextMenu();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "manage_queries") {
        openManageQueriesPopup();
        return; 
    }

    if (info.menuItemId === "custom_plan_changes") {
        let planChangesQuery = await getQuery("plan_changes");
        if (!planChangesQuery) {
            console.error("❌ No se encontró la query con ID: plan_changes");
            return;
        }
        copyQueryString(planChangesQuery, tab.id, tab.url);
        return; 
    }

    if (info.menuItemId === "custom_payments_core") {
        let paymentsCoreQuery = await getQuery("payments_core");
        if (!paymentsCoreQuery) {
            console.error("❌ No se encontró la query con ID: payments_core");
            return;
        }
        copyQueryString(paymentsCoreQuery, tab.id, tab.url);
        return;
    }

    if (info.menuItemId.startsWith("custom_dynamic_")) {
        let numericId = parseInt(info.menuItemId.replace("custom_dynamic_", ""), 10);
        let customQ = await getCustomQueryById(numericId);
        if (!customQ) {
            console.error(`❌ No se encontró la query personalizada con ID: ${numericId}`);
            return;
        }
        copyCustomQueryString(customQ, tab.id, tab.url);
        return;
    }

    if (info.menuItemId.startsWith("custom_")) {
        let queryId = info.menuItemId.replace("custom_", "");
        let query = await getQuery(queryId);
        if (!query) {
            console.error(`❌ No se encontró la query con ID: ${queryId}`);
            return;
        }
        copyQueryString(query, tab.id, tab.url);
        return;
    }
});

function copyQueryString(query, tabId, url) {
    let storeId = getStoreId(url);
    if (!query) {
        console.error("❌ Error: La Query está vacía o no definida.");
        return;
    }
    let finalQuery = query.replace("{STORE_ID}", storeId ? storeId : "STORE_ID");
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: injectAndCopy,
        args: [finalQuery]
    });
}

function copyCustomQueryString(customQ, tabId, url) {
    let storeId = getStoreId(url);
    if (!customQ.query) {
        console.error("❌ Error: La query personalizada está vacía o no definida.");
        return;
    }
    let finalStr = customQ.query;
    if (storeId) {
        finalStr = finalStr.replace("{STORE_ID}", storeId);
    }
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: injectAndCopy,
        args: [finalStr]
    });
}

function injectAndCopy(text) {
    const fallbackCopy = (str) => {
        const textArea = document.createElement("textarea");
        textArea.value = str;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
    };

    const showToast = (msg) => {
        let toast = document.createElement("div");
        toast.textContent = msg;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-size: 14px;
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.5s;
        `;
        document.body.appendChild(toast);

        setTimeout(() => toast.style.opacity = "1", 100);
        setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    };

    navigator.clipboard.writeText(text)
        .then(() => {
            showToast("✅ Query copiada al portapapeles!");
        })
        .catch(err => {
            console.warn("⚠️ Error con Clipboard API, usando fallback:", err);
            try {
                fallbackCopy(text);
                showToast("✅ Query copiada con método alternativo!");
            } catch (fallbackErr) {
                console.error("❌ Error en el fallback también:", fallbackErr);
            }
        });
}

function getStoreId(url) {
    let match = url.match(/[?&]store_id=(\d+)/);
    return match ? match[1] : null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SAVE_CUSTOM_QUERY") {
        handleSaveCustomQuery(message.payload)
            .then((result) => sendResponse(result))
            .catch((err) => sendResponse({ success: false, reason: err.message || err }));
        return true; 
    }
    else if (message.type === "GET_ALL_CUSTOM_QUERIES") {
        getAllCustomQueries()
            .then(queries => sendResponse({ success: true, queries }))
            .catch(err => sendResponse({ success: false, reason: err.toString() }));
        return true;
    }
    else if (message.type === "DELETE_CUSTOM_QUERY") {
        deleteCustomQuery(message.id)
            .then(() => {
                updateContextMenu(); 
                sendResponse({ success: true });
            })
            .catch(err => sendResponse({ success: false, reason: err.toString() }));
        return true;
    }
    else if (message.type === "UPDATE_CUSTOM_QUERY") {
        handleUpdateCustomQuery(message.payload)
            .then((result) => sendResponse(result))
            .catch((err) => sendResponse({ success: false, reason: err.message || err }));
        return true;
    }

    return false;
});

async function handleSaveCustomQuery({ nombre, descripcion, url, parametros, query, categoria }) {
    const existing = await findCustomQueryByName(nombre);
    if (existing) {
        return { success: false, reason: "DUPLICATE_NAME" };
    }
    const newId = await addCustomQuery({ nombre, descripcion, url, parametros, query, categoria });
    const savedRecord = await getCustomQueryById(newId);
    if (!savedRecord) {
        return { success: false, reason: "INSERT_FAILED" };
    }

    chrome.storage.local.set({ query_list_updated: Date.now() });

    return { success: true, id: newId };
}

async function handleUpdateCustomQuery({ id, nombre, descripcion, url, parametros, query, categoria }) {
    const all = await getAllCustomQueries();
    const duplicate = all.find(item => item.nombre === nombre && item.id !== id);
    if (duplicate) {
        return { success: false, reason: "DUPLICATE_NAME" };
    }

    const original = await getCustomQueryById(id);
    if (!original) {
        return { success: false, reason: "NOT_FOUND" };
    }

    const updated = {
        id,
        nombre,
        descripcion,
        url,
        parametros,
        query,
        categoria
    };

    await updateCustomQuery(updated);

    chrome.storage.local.set({ query_list_updated: Date.now() });

    updateContextMenu();

    return { success: true, id };
}

async function findCustomQueryByName(nombre) {
    const all = await getAllCustomQueries();
    return all.find(item => item.nombre === nombre) || null;
}
