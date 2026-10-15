# DeepSeek + ADK 使用教學

這份文件說明如何在 Google ADK(Agent Development Kit)中接入 DeepSeek，並建立一個可執行的 AI Agent。

## 1. 先說明整體架構

我們會使用以下方式組合：

- `google-adk`：建立`Agent`
- `litellm`：作為大模型適配層
- `python-dotenv`：讀取 `.env` 環境變數
- `DeepSeek API`：提供模型推理能力

核心思路是：

```python
model=LiteLlm(
    model="deepseek/deepseek-v4-flash",
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    api_base=os.getenv("DEEPSEEK_API_BASE"),
)
```

這樣 ADK 就能用 DeepSeek 來回答問題、執行工具，以及啟動 AI Agent。


## 2. 環境準備

### 2.1 檢查 Python

先確認你的系統已安裝 Python：

```bash
python --version
```

建議使用 Python 3.10 以上版本。

### 2.2 建立專案

1. 克隆項目

    ```
    git clone https://github.com/huafua/adk-demo
    ```

2. 安裝相依套件

    到項目目錄中，執行`pip install -r requirements.txt`

3. 取得 DeepSeek API Key

    - 登入 DeepSeek 官方平台
    - 進入 API 金鑰管理頁面
    - 建立新的 API Key
    - 複製金鑰並妥善保存

    > 請不要把 API Key 寫死在程式碼裡，也不要提交到公開 GitHub 專案中。

4. 設定 `.env`

    在專案根目錄建立 `.env`：

    ```env
    DEEPSEEK_API_KEY="your_deepseek_api_key_here"
    DEEPSEEK_API_BASE="https://api.deepseek.com"
    ```

5. 建立 Agent 程式碼

    建立 `agent.py`：

    ```python
    import os
    from dotenv import load_dotenv
    from google.adk import Agent, Runner
    from google.adk.models.lite_llm import LiteLlm

    load_dotenv()

    MODEL_NAME = "deepseek/deepseek-v4-flash"


    def get_weather(city: str) -> str:
        """取得指定城市的天氣資訊。"""
        return f"{city} 目前天氣晴朗，氣溫 25 度。"


    root_agent = Agent(
        name="DeepSeekAgent",
        instruction="你是一個由 DeepSeek 驅動的助手，請使用繁體中文回答問題，必要時可調用工具。",
        model=LiteLlm(
            model=MODEL_NAME,
            api_key=os.getenv("DEEPSEEK_API_KEY"),
            api_base=os.getenv("DEEPSEEK_API_BASE"),
        ),
        tools=[get_weather],
    )


    if __name__ == "__main__":
        print("正在啟動 DeepSeek ADK Agent...")
        Runner(root_agent).run()
    ```

6. 執行 Agent

    在終端機中執行：

    ```bash
    python agent.py
    ```

    如果一切正常，系統會啟動互動式 Agent。你可以輸入：

    ```text
    你好
    ```

    或：

    ```text
    請問台北今天的天氣如何？
    ```

    若你有定義工具，Agent 可能會自動判斷是否需要使用該工具。

7. 模型名稱說明

    DeepSeek 在 LiteLLM 裡通常使用這種格式：

    ```text
    deepseek/deepseek-chat
    deepseek/deepseek-reasoner
    deepseek/deepseek-v3
    deepseek/deepseek-v4-flash
    openai/deepseek-chat
    ```

    常見設定：

    ```python
    MODEL_NAME = "deepseek/deepseek-v4-flash"
    ```

    如果你遇到錯誤，例如：

    - `model not found`
    - `invalid model name`
    - `401 Unauthorized`

    通常代表以下任一項有問題：

    - 模型名稱填錯
    - API Key 無效
    - API Base URL 錯誤

### 3. 常見問題排查

- **ModuleNotFoundError: No module named 'google.adk'**

    修正方式：

    ```bash
    pip install -r requirements.txt
    ```
    確認你已經啟用正確的虛擬環境。

- **401 Unauthorized**

    代表 API 金鑰無法被驗證。請確認：

    - `.env` 是否正確
    - `DEEPSEEK_API_KEY` 是否值正確
    - API 金鑰是否過期或失效

    - `model not found`

    請檢查：

    ```python
    MODEL_NAME = "deepseek/deepseek-v4-flash"
    ```

    或嘗試更常見的名稱：

    ```python
    MODEL_NAME = "deepseek/deepseek-chat"
    ```

- **API timeout 或連線錯誤**

    請確認：

    - 網路可用
    - `DEEPSEEK_API_BASE="https://api.deepseek.com"`
    - 服務狀態正常


### 4. 加入更多工具(進階)

你可以讓 Agent 恢復更完整的能力，例如查天氣、查資料、讀取文件、整理摘要等

範例：

```python
import os
from dotenv import load_dotenv
from google.adk import Agent
from google.adk.models.lite_llm import LiteLlm

load_dotenv()

MODEL_NAME = "deepseek/deepseek-v4-flash"

def search_docs(keyword: str) -> str:
    return f"已搜尋關鍵字: {keyword}，這裡是相關文件內容摘要。"

def get_current_time() -> str:
    import datetime
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

root_agent = Agent(
    name="workflow_agent",
    instruction="你是一個有工具能力的助手，請優先使用工具來回答使用者問題。",
    model=LiteLlm(
        model=MODEL_NAME,
        api_key=os.getenv("DEEPSEEK_API_KEY"),
        api_base=os.getenv("DEEPSEEK_API_BASE"),
    ),
    tools=[search_docs, get_current_time],
)
```
這樣 Agent 就不只是聊天，還能根據需求呼叫工具。

### 5. 最佳實務建議

    - 不要把 API Key 直接寫進程式碼
    - 把敏感設定放進 `.env`
    - 先用最簡單的 Agent 測試，再逐步擴大功能
    - 如果模型名稱或金鑰有錯，優先檢查這兩個項目

### 6. 完整總結

使用 DeepSeek + ADK 的流程可以概括為：

1. 安裝 `google-adk`、`litellm`、`python-dotenv`
2. 取得 DeepSeek API Key
3. 建立 `.env`
4. 在 `LiteLlm` 中指定 `model` 與 `api_base`
5. 建立 `Agent`
6. 註冊工具（可選）
7. 執行 `python agent.py`
8. 測試文字互動與工具呼叫

只要完成上述步驟，你就能在 ADK 中成功使用 DeepSeek 作為模型後端。