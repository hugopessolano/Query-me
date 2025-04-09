/**********************************************
 * popup_manager.js
 **********************************************/
function openAddQueryPopup() {
  chrome.windows.create({
    url: "popup_add_query.html",
    type: "popup",
    width: 600,
    height: 600,
    focused: true
  });
}

// (REMOVIDO) openDeleteQueryPopup() ya no se usa en ningún lado

function openManageQueriesPopup() {
  chrome.windows.create({
    url: "popup_manager.html",
    type: "popup",
    width: 500,
    height: 500,
    focused: true
  });
}
