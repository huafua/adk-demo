const keyList = document.getElementById("key-list");
const keyCount = document.getElementById("key-count");
const listCount = document.getElementById("list-count");
const refreshButton = document.getElementById("refresh-button");
const createForm = document.getElementById("create-form");
const createButton = document.getElementById("create-button");
const tokenInput = document.getElementById("new-token");
const regenerateButton = document.getElementById("regenerate-token");
const copyPendingButton = document.getElementById("copy-pending-token");
const notice = document.getElementById("notice");
const selectionToolbar = document.getElementById("selection-toolbar");
const selectAllCheckbox = document.getElementById("select-all-keys");
const selectedCountLabel = document.getElementById("selected-count");
const bulkStatusButton = document.getElementById("bulk-status-button");
const bulkDeleteButton = document.getElementById("bulk-delete-button");
const deleteDialog = document.getElementById("delete-dialog");
const deleteDialogTitle = document.getElementById("delete-dialog-title");
const deleteDialogDescription = document.getElementById("delete-dialog-description");
const deleteDialogError = document.getElementById("delete-dialog-error");
const cancelDeleteButton = document.getElementById("cancel-delete");
const confirmDeleteButton = document.getElementById("confirm-delete");
let noticeTimeout;
let pendingApiKey = "";
let pendingDeleteApiKeys = [];
let isDeleting = false;
let isUpdatingStatuses = false;
let selectedApiKeys = new Set();
const showApiKeyIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
const hideApiKeyIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a15.7 15.7 0 0 1-3.1 3.9"/><path d="M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7c1 0 1.9-.2 2.8-.5"/></svg>';
const enableApiKeyIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></svg>';
const disableApiKeyIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>';

function showNotice(message, kind) {
    window.clearTimeout(noticeTimeout);
    notice.textContent = message;
    notice.dataset.kind = kind || "success";
    notice.hidden = false;
    noticeTimeout = window.setTimeout(() => {
        notice.hidden = true;
    }, 3600);
}

function makeIconButton(label, svgMarkup, onClick) {
    const button = document.createElement("button");
    button.className = "icon-button";
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.innerHTML = svgMarkup;
    button.addEventListener("click", onClick);
    return button;
}

function resetDeleteDialogState() {
    pendingDeleteApiKeys = [];
    deleteDialogError.textContent = "";
    deleteDialogError.hidden = true;
    confirmDeleteButton.disabled = false;
    cancelDeleteButton.disabled = false;
    confirmDeleteButton.textContent = "刪除金鑰";
    deleteDialogTitle.textContent = "刪除授權金鑰？";
    deleteDialogDescription.textContent =
        "刪除後，使用這組金鑰的服務將無法通過授權。此操作無法復原。";
}

function updateDeleteDialogContent(count) {
    deleteDialogTitle.textContent = "刪除 " + count + " 把授權金鑰？";
    deleteDialogDescription.textContent =
        "刪除後，使用這些金鑰的服務將無法通過授權。此操作無法復原。";
    confirmDeleteButton.textContent = count > 1 ? "刪除 " + count + " 把金鑰" : "刪除金鑰";
}

function openDeleteDialog(apiKeys) {
    resetDeleteDialogState();
    pendingDeleteApiKeys = [...apiKeys];
    updateDeleteDialogContent(pendingDeleteApiKeys.length);
    deleteDialog.showModal();
}

function updateSelectionControls() {
    const checkboxes = Array.from(keyList.querySelectorAll(".key-select"));
    const selectedCheckboxes = checkboxes.filter(checkbox => checkbox.checked);
    const selectedCount = selectedCheckboxes.length;
    const allSelectedEnabled = selectedCheckboxes.length > 0
        && selectedCheckboxes.every(checkbox => checkbox.dataset.enabled === "true");
    selectionToolbar.hidden = checkboxes.length === 0;
    selectAllCheckbox.disabled = checkboxes.length === 0 || isUpdatingStatuses;
    selectAllCheckbox.checked = checkboxes.length > 0 && selectedCount === checkboxes.length;
    selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < checkboxes.length;
    selectedCountLabel.textContent = "已選 " + selectedCount + " 把";
    const bulkStatusLabel = allSelectedEnabled ? "停用所選" : "啟用所選";
    bulkStatusButton.textContent = bulkStatusLabel;
    bulkStatusButton.setAttribute("aria-label", bulkStatusLabel + "金鑰");
    bulkStatusButton.title = bulkStatusLabel + "金鑰";
    bulkStatusButton.disabled = selectedCount === 0 || isUpdatingStatuses;
    bulkDeleteButton.disabled = selectedCount === 0 || isDeleting || isUpdatingStatuses;
    checkboxes.forEach(checkbox => {
        checkbox.disabled = isUpdatingStatuses;
    });
    keyList.querySelectorAll(".key-toggle-button").forEach(button => {
        button.disabled = isUpdatingStatuses;
    });
}

function makeKeyItem(keyEntry, index) {
    const { apiKey, enabled } = keyEntry;
    const item = document.createElement("div");
    item.className = "key-item";

    const main = document.createElement("div");
    main.className = "key-main";

    const checkbox = document.createElement("input");
    checkbox.className = "key-select";
    checkbox.type = "checkbox";
    checkbox.value = apiKey;
    checkbox.checked = selectedApiKeys.has(apiKey);
    checkbox.dataset.enabled = String(enabled);
    checkbox.setAttribute("aria-label", "選取授權金鑰 " + String(index + 1).padStart(2, "0"));
    checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
            selectedApiKeys.add(apiKey);
        } else {
            selectedApiKeys.delete(apiKey);
        }
        updateSelectionControls();
    });

    const indicator = document.createElement("span");
    indicator.className = "key-indicator";
    indicator.setAttribute("aria-hidden", "true");
    indicator.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8 2 2-2 2 2 2-3 3-2-2-2 2"/></svg>';

    const info = document.createElement("div");
    info.className = "key-info";
    const titleRow = document.createElement("div");
    titleRow.className = "key-title-row";
    const name = document.createElement("div");
    name.className = "key-name";
    name.textContent = "授權金鑰 " + String(index + 1).padStart(2, "0");
    const status = document.createElement("span");
    status.className = "key-status " + (enabled ? "key-status-enabled" : "key-status-disabled");
    status.textContent = enabled ? "啟用中" : "已停用";
    const value = document.createElement("code");
    value.className = "key-value";
    value.dataset.token = apiKey;
    value.textContent = maskToken(apiKey);
    titleRow.append(name, status);
    info.append(titleRow, value);

    const actions = document.createElement("div");
    actions.className = "key-actions";
    let revealed = false;
    const revealButton = makeIconButton("顯示金鑰", showApiKeyIcon, () => {
        revealed = !revealed;
        value.textContent = revealed ? apiKey : maskToken(apiKey);
        const label = revealed ? "隱藏金鑰" : "顯示金鑰";
        revealButton.setAttribute("aria-label", label);
        revealButton.title = label;
        revealButton.innerHTML = revealed ? hideApiKeyIcon : showApiKeyIcon;
    });
    revealButton.title = "顯示金鑰";
    const copyButton = makeIconButton("複製金鑰", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>', async () => {
        try {
            await navigator.clipboard.writeText(apiKey);
            showNotice("已複製授權金鑰。");
        } catch (error) {
            showNotice("無法存取剪貼簿，請先顯示金鑰後手動複製。", "error");
        }
    });
    const deleteButton = makeIconButton("刪除授權金鑰", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></svg>', async () => {
        openDeleteDialog([apiKey]);
    });
    deleteButton.classList.add("icon-button-danger");
    const statusButton = makeIconButton(
        (enabled ? "停用" : "啟用") + "授權金鑰 " + String(index + 1).padStart(2, "0"),
        enabled ? disableApiKeyIcon : enableApiKeyIcon,
        () => changeApiKeyStatuses([apiKey], !enabled)
    );
    statusButton.classList.add("key-toggle-button");
    statusButton.title = enabled ? "停用金鑰" : "啟用金鑰";
    if (enabled) {
        statusButton.classList.add("icon-button-danger");
    }
    statusButton.disabled = isUpdatingStatuses;
    actions.append(statusButton, revealButton, copyButton, deleteButton);
    main.append(checkbox, indicator, info);
    item.append(main, actions);
    return item;
}

function maskToken(token) {
    if (token.length <= 8) {
        return "•".repeat(token.length);
    }
    return token.slice(0, 4) + "•".repeat(Math.min(token.length - 8, 12)) + token.slice(-4);
}

function generateToken() {
    const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
    let suffix = "";
    while (suffix.length < 32) {
        const randomValues = new Uint8Array(64);
        window.crypto.getRandomValues(randomValues);
        for (const value of randomValues) {
            if (value < 252) {
                suffix += alphabet[value % alphabet.length];
                if (suffix.length === 32) {
                    break;
                }
            }
        }
    }
    pendingApiKey = "sk-" + suffix;
    tokenInput.value = pendingApiKey;
}

async function loadKeys() {
    keyList.setAttribute("aria-busy", "true");
    keyList.replaceChildren();
    updateSelectionControls();
    const loading = document.createElement("div");
    loading.className = "loading-state";
    loading.textContent = "正在載入授權金鑰…";
    keyList.append(loading);
    refreshButton.disabled = true;

    try {
        const response = await fetch("/keys");
        if (!response.ok) {
            throw new Error("金鑰清單載入失敗（HTTP " + response.status + "）");
        }
        const keys = await response.json();
        if (!Array.isArray(keys) || keys.some(key => !key
            || typeof key.apiKey !== "string" || typeof key.enabled !== "boolean")) {
            throw new Error("伺服器回傳的金鑰資料格式不正確。");
        }

        const currentKeys = new Set(keys.map(key => key.apiKey));
        selectedApiKeys = new Set(Array.from(selectedApiKeys).filter(key => currentKeys.has(key)));
        keyCount.textContent = String(keys.filter(key => key.enabled).length);
        listCount.textContent = String(keys.length);
        keyList.replaceChildren();
        if (keys.length === 0) {
            const empty = document.createElement("div");
            empty.className = "empty-state";
            empty.textContent = "目前尚無授權金鑰。建立第一組金鑰即可開始使用。";
            keyList.append(empty);
        } else {
            keys.forEach((key, index) => keyList.append(makeKeyItem(key, index)));
        }
        updateSelectionControls();
    } catch (error) {
        keyCount.textContent = "—";
        listCount.textContent = "—";
        const errorState = document.createElement("div");
        errorState.className = "error-state";
        errorState.textContent = error.message || "載入金鑰時發生錯誤，請稍後重試。";
        keyList.replaceChildren(errorState);
        updateSelectionControls();
        showNotice(errorState.textContent, "error");
    } finally {
        keyList.setAttribute("aria-busy", "false");
        refreshButton.disabled = false;
    }
}

async function setApiKeysEnabled(apiKeys, enabled) {
    const response = await fetch("/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKeys, enabled })
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "更新金鑰狀態失敗（HTTP " + response.status + "）");
    }

    const result = await response.json();
    if (!result || result.updated !== apiKeys.length) {
        throw new Error("伺服器回傳的狀態更新結果不正確。");
    }
}

async function changeApiKeyStatuses(apiKeys, enabled) {
    if (apiKeys.length === 0 || isUpdatingStatuses) {
        return;
    }

    isUpdatingStatuses = true;
    updateSelectionControls();
    try {
        await setApiKeysEnabled(apiKeys, enabled);
        showNotice("已" + (enabled ? "啟用" : "停用") + " " + apiKeys.length + " 把 API key。");
        await loadKeys();
    } catch (error) {
        showNotice(error.message || "更新金鑰狀態時發生錯誤，請稍後重試。", "error");
    } finally {
        isUpdatingStatuses = false;
        updateSelectionControls();
    }
}

async function deleteApiKeys(apiKeys) {
    let deletedCount = 0;
    const failures = [];

    for (const apiKey of apiKeys) {
        try {
            const response = await fetch("/delete?apiKey=" + encodeURIComponent(apiKey), {
                method: "DELETE"
            });
            if (!response.ok) {
                const detail = await response.text();
                throw new Error(detail || "刪除金鑰失敗（HTTP " + response.status + "）");
            }
            selectedApiKeys.delete(apiKey);
            deletedCount++;
        } catch (error) {
            failures.push({
                apiKey,
                message: error.message || "刪除金鑰時發生錯誤。"
            });
        }
    }

    return { deletedCount, failures };
}

refreshButton.addEventListener("click", loadKeys);

selectAllCheckbox.addEventListener("change", () => {
    const checkboxes = Array.from(keyList.querySelectorAll(".key-select"));
    selectedApiKeys = selectAllCheckbox.checked
        ? new Set(checkboxes.map(checkbox => checkbox.value))
        : new Set();
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
    updateSelectionControls();
});

bulkStatusButton.addEventListener("click", () => {
    const selectedCheckboxes = Array.from(keyList.querySelectorAll(".key-select:checked"));
    const shouldEnable = selectedCheckboxes.some(checkbox => checkbox.dataset.enabled === "false");
    changeApiKeyStatuses(Array.from(selectedApiKeys), shouldEnable);
});

bulkDeleteButton.addEventListener("click", () => {
    const selectedKeys = Array.from(selectedApiKeys);
    if (selectedKeys.length > 0) {
        openDeleteDialog(selectedKeys);
    }
});

cancelDeleteButton.addEventListener("click", () => {
    if (!isDeleting) {
        deleteDialog.close();
    }
});

deleteDialog.addEventListener("cancel", event => {
    if (isDeleting) {
        event.preventDefault();
    }
});

deleteDialog.addEventListener("close", () => {
    if (deleteDialog.open) {
        return;
    }
    resetDeleteDialogState();
});

confirmDeleteButton.addEventListener("click", async () => {
    if (pendingDeleteApiKeys.length === 0 || isDeleting) {
        return;
    }

    isDeleting = true;
    confirmDeleteButton.disabled = true;
    cancelDeleteButton.disabled = true;
    confirmDeleteButton.textContent = "刪除中…";
    deleteDialogError.textContent = "";
    deleteDialogError.hidden = true;

    const { deletedCount, failures } = await deleteApiKeys([...pendingDeleteApiKeys]);

    isDeleting = false;
    if (failures.length > 0) {
        pendingDeleteApiKeys = failures.map(failure => failure.apiKey);
        await loadKeys();
        updateDeleteDialogContent(pendingDeleteApiKeys.length);
        confirmDeleteButton.disabled = false;
        cancelDeleteButton.disabled = false;
        deleteDialogError.textContent =
            "已刪除 " + deletedCount + " 把；" + failures.length + " 把失敗。 " + failures[0].message;
        deleteDialogError.hidden = false;
        updateSelectionControls();
        return;
    }

    deleteDialog.close();
    showNotice("已刪除 " + deletedCount + " 把授權金鑰。");
    await loadKeys();
});

regenerateButton.addEventListener("click", () => {
    try {
        generateToken();
    } catch (error) {
        showNotice("無法安全產生金鑰，請使用支援 Web Crypto 的瀏覽器。", "error");
    }
});

copyPendingButton.addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(pendingApiKey);
        showNotice("已複製待建立的金鑰。");
    } catch (error) {
        showNotice("無法存取剪貼簿，請手動複製金鑰。", "error");
    }
});

createForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!pendingApiKey) {
        showNotice("尚未產生金鑰，請重新產生後再試。", "error");
        return;
    }

    createButton.disabled = true;
    try {
        const response = await fetch("/create", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ apiKey: pendingApiKey })
        });
        if (!response.ok) {
            const detail = await response.text();
            throw new Error(detail || "建立金鑰失敗（HTTP " + response.status + "）");
        }

        showNotice("授權金鑰已成功建立。");
        generateToken();
        await loadKeys();
    } catch (error) {
        showNotice(error.message || "建立金鑰時發生錯誤，請稍後重試。", "error");
    } finally {
        createButton.disabled = false;
    }
});

try {
    generateToken();
} catch (error) {
    createButton.disabled = true;
    showNotice("無法安全產生金鑰，請使用支援 Web Crypto 的瀏覽器。", "error");
}

loadKeys();