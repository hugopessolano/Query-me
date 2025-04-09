
function detectActiveTabAndPlanChanges() {
    let billingEngineTab = document.querySelector("#billingengine");
    let paymentsTab = document.querySelector("#be-payments");
    let chargesTab = document.querySelector("#be-charges");

    let paymentsCoreTab = document.querySelector("li.active a[href='#payments']");

    let activeTab = "other";
    let activeSubTab = "none";

    if (billingEngineTab && billingEngineTab.classList.contains("active")) {
        activeTab = "billingengine";
        if (paymentsTab && paymentsTab.classList.contains("active")) {
            activeSubTab = "payments";
        } else if (chargesTab && chargesTab.classList.contains("active")) {
            activeSubTab = "charges";
        }
        console.log(`✅ Billing Engine está activo - Subtab: ${activeSubTab}`);
    }
    else if (paymentsCoreTab) {
        activeTab = "paymentsCore";
        console.log("✅ Solapa de Pagos y Crédito (Core) está activa.");
    }

    const planChangesContainer = document.querySelector(
      "div[style='clear: both; margin-left: 20px; margin-bottom: 20px;']"
    );
    let planChanges = !!planChangesContainer; 

    chrome.runtime.sendMessage({
        type: "UPDATE_ACTIVE_TAB",
        activeTab,
        activeSubTab,
        planChanges
    });
}

document.addEventListener("click", (event) => {
    if (event.target.closest("#be-tabs li a") || event.target.closest("li a[href='#payments']")) {
        setTimeout(detectActiveTabAndPlanChanges, 100);
    }
});

const observer = new MutationObserver(() => detectActiveTabAndPlanChanges());
observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class"] 
});

document.addEventListener("DOMContentLoaded", detectActiveTabAndPlanChanges);

