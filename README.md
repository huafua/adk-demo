# ADK Demo

這個專案包含兩個 Google ADK 應用：一個使用 DeepSeek 回答數學問題的工作流，以及一個以正體中文回答 React 問題的教師 Agent。

## 專案結構

```text
teacher_agent/
  agent.py          # React 教學 Agent，匯出 root_agent
workflow_agent/
  agent.py          # 數學問答 Workflow，匯出 root_agent
requirements.txt   # 目前為空
```
先確認 Python 版本：

```powershell
python --version
```

建議使用 Python 3.10 或更新版本。在專案根目錄建立並啟用虛擬環境，再安裝目前使用的套件：
## 安裝

在專案根目錄建立並啟用虛擬環境，再安裝目前使用的套件：

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install google-adk litellm python-dotenv
```

請使用自己的有效 API 金鑰。不要將 API 金鑰寫死在程式碼或提交到版本控制；若金鑰曾經外洩，請立即撤銷並重新建立。
`requirements.txt` 目前沒有列出相依套件，因此上述安裝命令直接指定所需套件。

## 設定 DeepSeek

執行 Agent 前，設定下列環境變數：

```text
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_API_BASE=https://api.deepseek.com
```

PowerShell 範例：

```powershell
$env:DEEPSEEK_API_KEY = "your_deepseek_api_key"
$env:DEEPSEEK_API_BASE = "https://api.deepseek.com"

## 常見問題

- **找不到 `google.adk`**：確認虛擬環境已啟用，並在該環境執行 `python -m pip install google-adk litellm python-dotenv`。
- **401 Unauthorized**：確認 `DEEPSEEK_API_KEY` 有效，並檢查啟動該 Agent 的 shell 是否有設定金鑰。
- **找不到模型或模型名稱無效**：檢查 Agent 的 `LiteLlm` 設定。工作流目前使用 `deepseek/deepseek-flash`，教師 Agent 使用 `deepseek/deepseek-chat`；模型可用性依 DeepSeek 與 LiteLLM 支援情況而異。
- **連線逾時或 API 無法連線**：確認網路連線、`DEEPSEEK_API_BASE` 是否為 `https://api.deepseek.com`，以及 API 服務是否正常。
```

也可以將變數放在專案根目錄的 `.env`。`workflow_agent/agent.py` 會載入 `.env`；`teacher_agent/agent.py` 不會自行載入 `.env`，使用該 Agent 時請先在 shell 設定環境變數。不要將 API 金鑰提交到版本控制。

## 應用說明

### 數學問答工作流

`workflow_agent/agent.py` 的 `root_agent` 是一個 ADK `Workflow`：

1. `math_question` 讀取使用者訊息並轉成大寫。
2. `receiver_agent` 使用 `deepseek/deepseek-flash` 產生數學回答。
3. `hello` 和 `goodbye` 分支分別將輸入保存至工作階段狀態，並回傳各自的完成標記。
4. `process` 讀取兩個分支的狀態並組合工作流輸出。

### React 教師 Agent

`teacher_agent/agent.py` 匯出一般 ADK Agent，使用 `deepseek/deepseek-chat`，以正體中文回答 React 前端框架相關問題。

## 啟動 ADK 網頁介面

從專案根目錄執行其中一個命令：

```powershell
adk web workflow_agent
```

或啟動 React 教師 Agent：

```powershell
adk web teacher_agent
```

啟動後，依終端機顯示的網址開啟網頁介面。若找不到 `adk` 命令，請確認虛擬環境已啟用並已安裝 `google-adk`。ADK Web 是供本機開發使用的未驗證服務，請勿公開暴露在不可信任的網路上。