const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
// 簡單的授權伺服器，檢查請求中的 Authorization 標頭是否有效
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");

fs.mkdirSync(DATA_DIR, { recursive: true });

const keyUtil = {

    /**
     * 從 keys.txt 中讀取授權令牌列表
     * @returns {Set<string>} 有效的授權令牌列表
     */
    loadKeysFromKeysTxt() {
        const filePath = path.join(DATA_DIR, "keys.txt");
        if (!fs.existsSync(filePath)) {
            return new Set();
        }
        const content = fs.readFileSync(filePath, "utf-8");
        return new Set(content.split(/\r?\n/).filter(line => line.trim() !== ""));
    },

    /**
     * 取得授權令牌的指紋（SHA-256 雜湊）
     * @param {string} apiKey 授權令牌
     * @returns {string} 授權令牌的指紋（SHA-256 雜湊）
     */
    getApiKeyFingerprint(apiKey) {
        return crypto.createHash("sha256").update(apiKey).digest("hex");
    },

    /**
     * 讀取已停用的授權令牌指紋集合
     * @returns {Set<string>} 已停用的授權令牌指紋集合
     */
    loadDisabledApiKeyFingerprints() {
        const filePath = path.join(DATA_DIR, "disabled-keys.txt");
        if (!fs.existsSync(filePath)) {
            return new Set();
        }
        const content = fs.readFileSync(filePath, "utf-8");
        return new Set(content.split(/\r?\n/).filter(line => line.trim() !== ""));
    },

    /**
     * 儲存已停用的授權令牌指紋集合到 disabled-keys.txt
     * @param {Set<string>} fingerprints 已停用的授權令牌指紋集合
     */
    saveDisabledApiKeyFingerprints(fingerprints) {
        fs.writeFileSync(
            path.join(DATA_DIR, "disabled-keys.txt"),
            Array.from(fingerprints).join("\n"),
            "utf-8"
        );
    },

    /**
     * 刪除指定的授權令牌
     * @param {string} key 授權令牌
     * @returns {void}
     */
    deleteKey(key) {
        const keys = keyUtil.loadKeysFromKeysTxt();
        if (keys.has(key)) {
            keys.delete(key);
            fs.writeFileSync(path.join(DATA_DIR, "keys.txt"), Array.from(keys).join("\n"), "utf-8");
            const disabledKeys = keyUtil.loadDisabledApiKeyFingerprints();
            if (disabledKeys.delete(keyUtil.getApiKeyFingerprint(key))) {
                keyUtil.saveDisabledApiKeyFingerprints(disabledKeys);
            }
        }
    },
    /**
     * 檢查授權令牌是否有效
     * @param {string} apiKey 授權令牌
     * @returns {boolean} 是否為有效的授權令牌
     */
    hasApiKey(apiKey) {
        return keyUtil.loadKeysFromKeysTxt().has(apiKey);
    },

    /**
     * 檢查授權令牌是否有效（存在且未被停用）
     * @param {string} apiKey 授權令牌
     * @returns {boolean} 是否為有效的授權令牌
     */
    isValidApiKey(apiKey) {
        return keyUtil.hasApiKey(apiKey)
            && !keyUtil.loadDisabledApiKeyFingerprints().has(keyUtil.getApiKeyFingerprint(apiKey));
    },

    /**
     * 儲存授權令牌到 keys.txt
     * @param {string} apiKey 授權令牌
     */
    saveKey(apiKey) {
        const keys = keyUtil.loadKeysFromKeysTxt(); // 確保 keys.txt 存在
        const disabledKeys = keyUtil.loadDisabledApiKeyFingerprints();
        if (disabledKeys.delete(keyUtil.getApiKeyFingerprint(apiKey))) {
            keyUtil.saveDisabledApiKeyFingerprints(disabledKeys);
        }
        keys.add(apiKey);
        fs.writeFileSync(path.join(DATA_DIR, "keys.txt"), Array.from(keys).join("\n"), "utf-8");
    },

    /**
     * 設定多個授權令牌的啟用狀態
     * @param {string[]} apiKeys 授權令牌陣列
     * @param {boolean} enabled 是否啟用
     */
    setApiKeysEnabled(apiKeys, enabled) {
        const disabledKeys = keyUtil.loadDisabledApiKeyFingerprints();
        for (const apiKey of apiKeys) {
            const fingerprint = keyUtil.getApiKeyFingerprint(apiKey);
            if (enabled) {
                disabledKeys.delete(fingerprint);
            } else {
                disabledKeys.add(fingerprint);
            }
        }
        keyUtil.saveDisabledApiKeyFingerprints(disabledKeys);
    }
}


/**
 * 根據檔案副檔名返回對應的 MIME 類型
 * @param {string} ext 檔案副檔名
 * @returns {string} 對應的 MIME 類型
 */
function getMimeType(ext) {
    switch (ext) {
        case ".html": return "text/html";
        case ".css": return "text/css";
        case ".js": return "application/javascript";
        case ".json": return "application/json";
        case ".png": return "image/png";
        case ".jpg":
        case ".jpeg": return "image/jpeg";
        case ".gif": return "image/gif";
        default: return "application/octet-stream";
    }
}


/**
 * 處理授權請求，檢查 Authorization 標頭是否存在且有效
 * 若缺少或無效，回傳 401 並要求 Bearer 認證
 * @param {http.IncomingMessage} req 請求
 * @param {http.ServerResponse} res 回應
 * @returns {void}
 */
const handleRequest = (req, res) => {
    const urlObject = new URL(req.url, `http://${req.headers.host}`)
    // 解析請求的 URL，並檢查路徑和方法以決定如何處理請求
    if (urlObject.pathname === "/auth" && req.method === "GET") {
        // 取得請求中的 Authorization 標頭
        const authorization = req.headers["authorization"];

        // 若未提供 Authorization 標頭，回傳 401 並要求 Bearer 認證
        if (!authorization) {
            res.writeHead(401, { "WWW-Authenticate": "Bearer" });
            return res.end("Authorization required");
        }
        // 若提供的 Authorization 標頭無效，回傳 401 並要求 Bearer 認證
        if (!keyUtil.isValidApiKey(authorization.replace(/^Bearer\s+/, ""))) {
            res.writeHead(401, { "WWW-Authenticate": "Bearer" });
            return res.end("Authorization key is not valid");
        }
        // 若 Authorization 標頭有效，回傳 200 表示授權成功
        res.writeHead(200);
        return res.end("Authorized");
    }

    // 處理創建新授權令牌的請求
    if (urlObject.pathname == "/create" && req.method === "POST") {
        // 這裏應該從body中獲取token而不是從query中獲取，且content-type需要為 application/x-www-form-urlencoded
        if (req.headers["content-type"] !== "application/x-www-form-urlencoded") {
            res.writeHead(400);
            return res.end("Content-Type must be application/x-www-form-urlencoded");
        }
        let body = "";
        req.on("data", chunk => {
            body += chunk.toString();
        });
        return req.on("end", () => {
            const params = new URLSearchParams(body);
            const apiKey = params.get("apiKey");
            if (!apiKey) {
                res.writeHead(400);
                return res.end("ApiKey is required");
            }
            if (keyUtil.hasApiKey(apiKey)) {
                res.writeHead(400);
                return res.end("ApiKey already exists");
            }
            keyUtil.saveKey(apiKey);
            res.writeHead(200);
            return res.end("ApiKey created");
        });
    }

    // 返回 keys.txt 中的所有有效授權令牌
    if (urlObject.pathname == "/keys" && req.method === "GET") {
        const keys = keyUtil.loadKeysFromKeysTxt();
        if (keys) {
            res.writeHead(200, { "Content-Type": "application/json" });
            const disabledKeys = keyUtil.loadDisabledApiKeyFingerprints();
            const keyEntries = Array.from(keys, apiKey => ({
                apiKey,
                enabled: !disabledKeys.has(keyUtil.getApiKeyFingerprint(apiKey))
            }));
            return res.end(JSON.stringify(keyEntries));
        } else {
            res.writeHead(404);
            return res.end("Keys file not found");
        }
    }
    if (urlObject.pathname === "/status" && req.method === "PATCH") {
        const contentType = (req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
        if (contentType !== "application/json") {
            res.writeHead(400);
            return res.end("Content-Type must be application/json");
        }
        let body = "";
        req.on("data", chunk => {
            body += chunk.toString();
        });
        return req.on("end", () => {
            let request;
            try {
                request = JSON.parse(body);
            } catch (error) {
                res.writeHead(400);
                return res.end("Request body must be valid JSON");
            }

            if (!request || !Array.isArray(request.apiKeys) || request.apiKeys.length === 0
                || request.apiKeys.some(apiKey => typeof apiKey !== "string" || apiKey.length === 0)
                || typeof request.enabled !== "boolean") {
                res.writeHead(400);
                return res.end("apiKeys must be a non-empty string array and enabled must be a boolean");
            }

            const apiKeys = Array.from(new Set(request.apiKeys));
            const storedKeys = keyUtil.loadKeysFromKeysTxt();
            if (apiKeys.some(apiKey => !storedKeys.has(apiKey))) {
                res.writeHead(404);
                return res.end("One or more ApiKeys were not found");
            }

            try {
                keyUtil.setApiKeysEnabled(apiKeys, request.enabled);
            } catch (error) {
                console.error("Failed to update API key status:", error.message);
                res.writeHead(500);
                return res.end("Failed to update API key status");
            }
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ updated: apiKeys.length }));
        });
    }
    // 處理刪除授權令牌的請求
    if (urlObject.pathname == "/delete" && req.method === "DELETE") {
        const params = urlObject.searchParams;
        const apiKey = params.get("apiKey");
        if (!apiKey) {
            res.writeHead(400);
            return res.end("ApiKey is required");
        }
        if (!keyUtil.hasApiKey(apiKey)) {
            res.writeHead(404);
            return res.end("ApiKey not found");
        }
        keyUtil.deleteKey(apiKey);
        res.writeHead(200);
        return res.end("ApiKey deleted");
    }

    // 提供靜態文件服務，從 public 目錄中讀取對應的文件
    if (urlObject.pathname.startsWith("/static")) {
        const filePath = path.join(__dirname, "public", urlObject.pathname.replace("/static/", ""));
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const mimeType = getMimeType(ext);
            res.writeHead(200, { "Content-Type": mimeType });
            return res.end(fileContent);
        } else {
            res.writeHead(404);
            return res.end("Static file not found");
        }
    }


    // 若請求的路徑不符合任何已定義的處理規則，回傳 404 Not Found
    res.writeHead(404);
    res.end("Not Found");
}

// 啟動 HTTP 伺服器，監聽指定的 PORT
http.createServer(handleRequest).listen(PORT, () =>
    // 伺服器啟動成功後，輸出提示訊息
    console.log(`\x1b[33m[${new Date().toISOString()}] - Server running at ${PORT}\x1b[0m`)
)