# 使用 Keyserver 驗證 Ollama API Key

本文說明如何讓 `ollama_based_agent` 經由 NGINX 呼叫本機 Ollama，並由 `keyserver` 驗證 API key。Ollama 本身的 OpenAI 相容 API 預設不驗證 key；Agent 必須使用 NGINX 的網址，直接呼叫 Ollama 會繞過驗證。

## 架構與請求流程

```text
ollama_based_agent (LiteLLM)
  Authorization: Bearer <api-key>
       │
       ▼
NGINX :81 /llm/...
  ├─ auth_request /auth/ ──► Keyserver :3000/auth
  └─ 驗證成功後 ───────────► Ollama :11434/v1/...
```

1. Agent 將 API key 放在 `Authorization: Bearer ...` 標頭。
2. NGINX 對每個 `/llm/` 請求發出內部 `/auth/` 子請求，並將授權標頭交給 Keyserver 的 `GET /auth`。
3. Keyserver 確認 key 存在且未停用後回傳 `200`；缺少、無效或停用的 key 回傳 `401`。
4. 只有認證成功時，NGINX 才將原始請求轉給 Ollama。`/llm/` 前綴會依 NGINX 設定映射成 Ollama 的 `/v1/` 路徑。

## 需求

- 已安裝並啟動 Ollama，以及 Agent 所使用的模型。
- Node.js 支援 `--env-file`（Node.js 20.6 或更新版本）。
- NGINX 已啟用 `auth_request` 模組。
- 專案根目錄 `requirements.txt` 中的 Python 套件已安裝。

## 啟動 Keyserver 與建立 key

Keyserver 預設監聽 `3000` 埠；可在 `keyserver/.env` 設定 `PORT`，並同步更新 NGINX 設定中的 Keyserver 連線埠。從專案根目錄執行：

```powershell
Set-Location .\keyserver
npm run dev
```

開啟管理頁面 `http://localhost:3000/static/index.html`，建立一組 key，並複製其值供 Agent 使用。管理頁面可檢視、啟用、停用及刪除 key。

Keyserver 將 key 明文存放在 `keyserver/data/keys.txt`；停用狀態則以 SHA-256 指紋存放在 `keyserver/data/disabled-keys.txt`。請勿提交真實 key 或含 key 的 `.env`。

## NGINX 設定

`keyserver/ollama-auth.conf` 範例內容如下：

```nginx
server {
    listen 81;
    server_name localhost;

    location /llm/ {
        auth_request /auth/;
        proxy_pass http://localhost:11434/v1/;
    }

    location /auth/ {
        internal;
        proxy_pass http://localhost:3000/auth;
    }
}
```

- `/auth/` 是僅供 NGINX 內部子請求使用的位置，不可由外部直接呼叫。
- `proxy_pass` 將 `/llm/models` 轉成 Ollama 的 `/v1/models`。
- LiteLLM 的 `api_base` 應設為 `http://127.0.0.1:81/llm`（不要在結尾加 `/v1`）。LiteLLM 會附加 `/chat/completions`，NGINX 再將 `/llm/chat/completions` 映射為 Ollama 的 `/v1/chat/completions`。
- 若 Keyserver 使用非預設埠，請將 `proxy_pass` 的 `3000` 改成相同埠。

測試並啟動 NGINX 時，請將路徑替換成實際 NGINX 安裝目錄及此設定檔的位置：

```powershell
.\nginx.exe -t -c C:\path\to\adk-demo\keyserver\ollama-auth.conf
.\nginx.exe -c C:\path\to\adk-demo\keyserver\ollama-auth.conf
```

此範例的 `listen 81` 會監聽所有網路介面。若只供本機 Agent 使用，建議改為 `listen 127.0.0.1:81;`，並確認防火牆沒有對外開放服務埠。

## 設定及執行 Agent

在 `ollama_based_agent/.env` 設定由 Keyserver 建立的 key 和 NGINX API 位址：

```env
OPENAI_API_KEY=<your-keyserver-api-key>
OPENAI_API_BASE=http://127.0.0.1:81/llm
```

不要在 `OPENAI_API_KEY` 值前加上 `Bearer `；LiteLLM 會自行建立授權標頭。`agent.py` 使用 `load_dotenv()` 載入環境變數。

從專案根目錄啟動互動式 Python Agent：

```powershell
python ollama_based_agent/agent.py
```

此命令執行 `another_main()`，使用 `jarvis_agent` 和模型 `openai/glm4:9b`。若使用 ADK Web 載入 `root_agent`，則會使用 `openai/llava:7b`：

```powershell
adk web ollama_based_agent
```

請先用 Ollama 下載所選入口使用的模型，例如：

```powershell
ollama pull glm4:9b
ollama pull llava:7b
```

這些模型名稱中的 `openai/` 是 LiteLLM 的 OpenAI 相容介面 provider 前綴；實際請求透過 `OPENAI_API_BASE` 指向本機 NGINX 與 Ollama。

## 驗證設定

確認 Keyserver、NGINX 和 Ollama 均已啟動，並以已建立的 key 測試：

```powershell
curl.exe -i -H "Authorization: Bearer <your-keyserver-api-key>" http://127.0.0.1:81/llm/models
```

認證成功後，請求會轉送至 Ollama 的 `/v1/models`。以下測試應分別得到 `401 Unauthorized`：

```powershell
# 缺少 Authorization 標頭
curl.exe -i http://127.0.0.1:81/llm/models

# 無效或已停用的 key
curl.exe -i -H "Authorization: Bearer invalid-key" http://127.0.0.1:81/llm/models
```

若回應為 `502 Bad Gateway`，請確認 Ollama 是否正在 `11434` 埠接受連線。若回應為 `401`，請確認 key 已在 Keyserver 建立且處於啟用狀態，並確認 Agent 使用 NGINX 的 API base，而不是直接使用 `http://localhost:11434/v1`。

## Keyserver API

| 方法與路徑 | 用途 |
| --- | --- |
| `GET /auth` | 驗證 `Authorization: Bearer <key>`；有效且啟用時回傳 `200`，缺少、無效或停用時回傳 `401`。 |
| `GET /keys` | 回傳 key 清單及 `enabled` 狀態。 |
| `POST /create` | 以 `application/x-www-form-urlencoded` 的 `apiKey=<key>` 建立 key。 |
| `PATCH /status` | 以 JSON `{ "apiKeys": ["<key>"], "enabled": false }` 批次啟用或停用 key。 |
| `DELETE /delete?apiKey=<key>` | 刪除指定 key。 |
| `GET /static/index.html` | 提供 key 管理頁面。 |

## 安全注意事項

- `/keys`、`/create`、`/status`、`/delete` 和管理頁面沒有額外身分驗證。Keyserver 目前以 `listen(PORT)` 啟動，可能監聽所有網路介面；請勿直接暴露到不可信任網路，並以防火牆或其他網路控制限制存取。
- `keyserver/data/keys.txt` 以明文保存 key。保護該檔案、`keyserver/.env` 及 `ollama_based_agent/.env`，並勿將真實 key 寫入文件或提交到版本控制。
- NGINX 範例使用 HTTP，且 `listen 81` 預設可能對其他主機可達。若需跨主機使用，應另外設定 TLS、防火牆及管理端點存取控制。
- 直接連接 Ollama 的 `11434` 埠會略過 Keyserver 驗證；請限制該埠的網路存取。
