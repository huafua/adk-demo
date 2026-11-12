# Ollama 本機模型 Agent

這個範例使用 Google ADK 建立一個以中文回答中國古代史問題的 Agent，並透過 LiteLLM 的 OpenAI 相容介面呼叫本機 Ollama 模型 `llava:7b`。模型和推論服務在本機執行，不需要設定雲端模型供應商的 API 金鑰。

## 需求

- Python 3.10 或更新版本
- 已安裝並可執行的 [Ollama](https://ollama.com/)
- 專案根目錄 `requirements.txt` 中的 Python 套件

## 安裝與設定

請在專案根目錄開啟 PowerShell，建立虛擬環境並安裝相依套件：

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

下載此 Agent 使用的模型：

```powershell
ollama pull llava:7b
```

確保 Ollama 服務正在執行。若 Ollama 尚未在背景啟動，可在另一個 PowerShell 視窗執行：

```powershell
ollama serve
```

Agent 使用 `OPENAI_API_KEY` 和 `OPENAI_API_BASE` 設定 LiteLLM。Ollama 的 OpenAI 相容 API 通常不驗證 API key；仍需提供非空值。可在 `ollama_based_agent/.env` 設定：

```env
OPENAI_API_KEY=your_api_key_please
OPENAI_API_BASE=http://localhost:11434/v1
```

程式會呼叫 `load_dotenv()` 載入環境變數。也可以改在目前 PowerShell 工作階段設定：

```powershell
$env:OPENAI_API_KEY = "your_api_key_please"
$env:OPENAI_API_BASE = "http://localhost:11434/v1"
```

若使用環境變數，請在啟動 Agent 的同一個 PowerShell 視窗設定。不要將真實服務的秘密金鑰提交到版本控制。

## 透過 NGINX 代理並驗證 API Key

若不希望 Agent 直接呼叫 Ollama 的 `11434` port，可以先經過本機 NGINX。此專案的 NGINX 設定在 `D:\Applications\nginx-1.30.6\conf`：`nginx.conf` 會載入 `demo.conf`，代理只監聽 `127.0.0.1:8080`，並將驗證通過的請求轉送至 `http://localhost:11434`。

### 設定 NGINX

在 `D:\Applications\nginx-1.30.6\conf\demo.conf` 設定驗證與代理。`map` 會把缺少的標頭標記為 `missing`，預設標記為 `invalid`，再將每個合法 key 標記為 `valid`。以下示範兩個 key；將佔位值替換成實際值，並為每個允許的 key 加一行：

```nginx
map $http_authorization $api_auth_status {
    default invalid;
    "" missing;
	~^Bearer[[:space:]]+replace_with_key_one$ valid;
	~^Bearer[[:space:]]+replace_with_key_two$ valid;
}

server {
	listen       127.0.0.1:8080;
	server_name  localhost;

	location / {
		default_type text/plain;
		if ($api_auth_status = missing) {
			add_header WWW-Authenticate 'Bearer' always;
			return 401 "Authorization required";
		}

		if ($api_auth_status = invalid) {
			add_header WWW-Authenticate 'Bearer' always;
			return 401 "Authorization key is not valid";
		}

		proxy_pass         http://localhost:11434;
		proxy_http_version 1.1;
		proxy_set_header   Host $proxy_host;
		proxy_set_header   Connection "";
		proxy_buffering    off;
		proxy_read_timeout 3600s;
	}
}
```

確認 `nginx.conf` 在 `http { ... }` 區塊內載入設定檔：

```nginx
http {
	include       mime.types;
	include       demo.conf;
	# 其他 HTTP 設定與 server 區塊
}
```

此專案的 `nginx.conf` 已包含 `include demo.conf;`。修改後在 PowerShell 測試並重新載入：

```powershell
cd D:\Applications\nginx-1.30.6
.\nginx.exe -t
.\nginx.exe -s reload
```

`map` 位於 `http` context，因此要放在 `server` 區塊之前；目前 `nginx.conf` 在 `http` 內載入 `demo.conf`，符合這個要求。`~` 表示大小寫敏感的正規表示式比對；若 key 含有正規表示式特殊字元，新增規則時必須跳脫該字元。沒有 Authorization 標頭時回應 `401 Authorization required`，不在 allowlist 時回應 `401 Authorization key is not valid`。這是靜態 allowlist，不提供 key 簽發、到期或輪替機制。

### 設定 Agent

在 `ollama_based_agent/.env` 使用 allowlist 中任一個 key，但**不要加上 `Bearer ` 前綴**。LiteLLM 會用 `OPENAI_API_KEY` 建立 Bearer Authorization 標頭；單一 Agent 執行時仍只會傳送一個 key：

```env
OPENAI_API_KEY=replace_with_your_key
OPENAI_API_BASE=http://127.0.0.1:8080/v1
```

也可以在啟動 Agent 的 PowerShell 工作階段設定：

```powershell
$env:OPENAI_API_KEY = "replace_with_your_key"
$env:OPENAI_API_BASE = "http://127.0.0.1:8080/v1"
```

啟動 Agent 後，請求會先送到 `127.0.0.1:8080`，由 NGINX 驗證 key，再轉送至 Ollama。直接使用 `http://localhost:11434/v1` 會繞過這層驗證。範例 listener 僅綁定 loopback，其他電腦無法連入；key 目前以明文放在 `demo.conf` 與本機 `.env`，請勿提交含真實 key 的設定檔。

## 執行

在專案根目錄直接執行程式。它會送出一個關於中國第一位皇帝的固定示範問題，並在終端機印出 Agent 回應：

```powershell
python ollama_based_agent/agent.py
```

也可以使用 ADK Web UI 互動測試：

```powershell
adk web ollama_based_agent
```

依終端機顯示的網址開啟介面並選取 Agent。請從專案根目錄啟動，讓 ADK 能正確載入 `ollama_based_agent`。ADK Web 是開發用介面；Ollama 預設服務也沒有對外驗證，請勿將它們暴露在不可信任的網路上。

## 程式重點

- `root_agent` 是 ADK 載入的 Agent 入口。
- `instruction` 要求 Agent 以中文、有趣的方式回答中國古代史問題。
- `LiteLlm(model="openai/llava:7b", ...)` 透過 OpenAI 相容 API 位址連到本機 Ollama；此處的 `openai/` 是 LiteLLM 的 provider 前綴，不表示請求會送往 OpenAI。
- `main()` 示範使用 `InMemorySessionService`、`Runner` 與非同步事件串流處理一次固定提問。工作階段只存在記憶體中。
- 雖然 `llava` 支援多模態能力，目前程式只傳送文字訊息，沒有提供圖片輸入。

## 常見問題

- **連線被拒絕**：確認 Ollama 正在執行，並檢查 `OPENAI_API_BASE` 是否為 `http://localhost:11434/v1`。
- **找不到模型**：執行 `ollama pull llava:7b`，並用 `ollama list` 確認模型已下載。
- **401 或 API key 錯誤**：確認 `OPENAI_API_KEY` 有設定。對本機 Ollama 可使用範例中的 `localhost-api`。
- **NGINX 回應 `Authorization required`**：確認 `OPENAI_API_KEY` 有值，且 Agent 使用 NGINX proxy 的 API base。
- **NGINX 回應 `Authorization key is not valid`**：確認 `.env` 的 `OPENAI_API_KEY` 完整符合 `demo.conf` 中其中一條 allowlist 規則；`.env` 值不要包含 `Bearer ` 前綴。
- **NGINX 回應 502 Bad Gateway**：確認 Ollama 正在 `localhost:11434` 接受連線，並檢查 NGINX error log。
- **找不到 Python 套件**：確認已啟用專案虛擬環境，並從專案根目錄安裝 `requirements.txt`。
- **模型回應很慢或記憶體不足**：`llava:7b` 需要足夠的系統資源；可確認 Ollama 是否成功載入模型，或改用 Ollama 支援且資源需求較低的模型，並同步更新 `agent.py` 的模型名稱。