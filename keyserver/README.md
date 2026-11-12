# Keyserver

Keyserver 是一個輕量的 API key 管理與驗證服務。它不會執行 Ollama 模型，也不是 Ollama 的 OpenAI 相容 API 代理；若要用它保護 Ollama API，請在 Agent 和 Ollama 之間使用 NGINX 等反向代理，讓代理先呼叫 Keyserver 驗證 key，再轉送模型請求。

```text
ADK Agent / LiteLLM
        │ Authorization: Bearer <api-key>
        ▼
反向代理（驗證通過才轉送）
        ├── 驗證請求 ──► Keyserver /authorize
        └── 模型請求 ──► Ollama /v1
```

## API key 與 Ollama 的關係

- Ollama 的本機 OpenAI 相容 API 預設不驗證 API key。若 Agent 直接連到 `http://localhost:11434/v1`，Keyserver 不會收到請求，也不會限制誰能呼叫模型。
- 若 Agent 經由反向代理連線，可將 Keyserver 建立的 key 設為 `OPENAI_API_KEY`。LiteLLM 會將它放入 `Authorization: Bearer <api-key>` 標頭。
- 反向代理必須設定為把這個標頭送到 Keyserver 的 `/authorize`，並且只在驗證成功時才把原始模型請求轉送到 Ollama。
- 專案 [`ollama_based_agent/README.md`](../ollama_based_agent/README.md) 也有一種 NGINX 靜態 allowlist 範例；那種設定不會查詢 Keyserver。若改用 Keyserver，請以本 README 的 `auth_request` 設定取代靜態 allowlist。

## 啟動 Keyserver

在 `keyserver/.env` 設定服務使用的埠號，例如：

```env
PORT=8888
```

從專案根目錄執行：

```powershell
Set-Location .\keyserver
npm run dev
```

管理頁面位於 `http://localhost:8888/static/index.html`（若 `PORT` 設為其他值，請替換網址中的埠號）。頁面可以建立 `sk-` 加 32 位小寫英數字的隨機 key、檢視、複製、啟用／停用及刪除 key，也支援批次切換狀態。

## API 端點

| 方法與路徑 | 用途 |
| --- | --- |
| `GET /authorize` | 從 `Authorization: Bearer <api-key>` 標頭驗證 key；存在且啟用時回傳 `200`，缺少、無效或停用時回傳 `401`。 |
| `GET /keys` | 以 JSON 陣列回傳 key 與 `enabled` 狀態，例如 `[{ "apiKey": "...", "enabled": true }]`。 |
| `POST /create` | 以 `application/x-www-form-urlencoded` 傳送 `apiKey=<key>` 來建立 key。 |
| `PATCH /status` | 以 JSON `{ "apiKeys": ["..."], "enabled": false }` 批次啟用或停用一組以上的 key；單筆操作也使用一個元素的陣列。 |
| `DELETE /delete?apiKey=<key>` | 刪除指定 key。 |

驗證請求範例：

```powershell
curl.exe -i -H "Authorization: Bearer <api-key>" http://127.0.0.1:8888/authorize
```

## 透過 NGINX 保護 Ollama

以下範例假設 Keyserver 使用 `8888`、NGINX 使用 `8080`、Ollama 使用預設的 `11434`。請將 `server` 區塊放在 NGINX 的 `http { ... }` 區塊中，並確認 NGINX 有啟用 `auth_request` 模組。

```nginx
server {
    listen 127.0.0.1:8080;
    server_name localhost;

    location = /_keyserver_auth {
        internal;
        proxy_pass http://127.0.0.1:8888/authorize;
        proxy_method GET;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header Authorization $http_authorization;
    }

    location / {
        auth_request /_keyserver_auth;
        proxy_pass http://127.0.0.1:11434;
        proxy_set_header Host $proxy_host;
        proxy_set_header Connection "";
        proxy_set_header Authorization "";
        proxy_buffering off;
        proxy_read_timeout 3600s;
    }
}
```

`/_keyserver_auth` 是 NGINX 內部子請求：它會將 Agent 傳來的 Bearer key 交給 Keyserver 的 `/authorize`。只有驗證成功，NGINX 才會將模型請求轉送至 Ollama；代理也會在轉送時移除 `Authorization` 標頭。

在 `ollama_based_agent/.env` 設定：

```env
OPENAI_API_KEY=<由 Keyserver 建立的 api-key>
OPENAI_API_BASE=http://127.0.0.1:8080/v1
```

不要在 `OPENAI_API_KEY` 值前加上 `Bearer `；LiteLLM 會自行建立 Authorization 標頭。若 `OPENAI_API_BASE` 直接指向 `http://localhost:11434/v1`，請求會繞過 NGINX 與 Keyserver 驗證。

## 安全注意事項

- Keyserver 目前將 key 以明文存放在 `data/keys.txt`，沒有到期時間或使用者權限機制。
- 停用狀態以 key 的 SHA-256 指紋存放在 `data/disabled-keys.txt`；既有 `data/keys.txt` 中的 key 初始都視為啟用。
- `/keys`、`/create`、`/status` 和 `/delete` 管理端點目前沒有額外身分驗證；不要將 Keyserver 管理服務直接暴露到不可信任的網路。
- 請保護 `data/keys.txt`、`data/disabled-keys.txt`、`.env` 與 `OPENAI_API_KEY`，不要提交真實 key 到版本控制。
- NGINX 範例只監聽本機回環介面。若要讓其他主機連線，請另外規劃 TLS、防火牆及管理端點的存取控制。
