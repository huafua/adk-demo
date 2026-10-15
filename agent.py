import os
from dotenv import load_dotenv
from google.adk import Agent, Runner  # 根據 ADK 實際套件結構匯入
from google.adk.models.lite_llm import LiteLlm  # 匯入 LiteLlm 模型類別

# 載入 .env 的環境變數
load_dotenv()

# 配置 DeepSeek 模型
# 在 LiteLLM 規範中，調用 DeepSeek 通常寫作 "deepseek/deepseek-chat" 或 "openai/deepseek-chat"
MODEL_NAME = "deepseek/deepseek-chat"

# 1. 定義一個簡單的工具 (Tools) 供 Agent 使用
def get_weather(city: str) -> str:
    """獲取指定城市的氣象資訊。"""
    return f"{city}目前天氣晴朗，氣溫 25 度。"

# 2. 建立 ADK Agent 實例
root_agent = Agent(
    name="DeepSeekAgent",
    instruction="你是一個由 DeepSeek 驅動的得力助手，請使用正體中文回答問題，並在需要時調用工具。",
    model=LiteLlm(model=MODEL_NAME,api_key=os.getenv("DEEPSEEK_API_KEY"),api_base=os.getenv("DEEPSEEK_API_BASE")),
    tools=[get_weather], # 將工具註冊給 Agent
)

# 3. 啟動 ADK 執行器 (Runner) 或 Web 介面
if __name__ == "__main__":
    print("正在啟動 DeepSeek ADK Agent...")
    # 啟動本地互動式命令列或 Web UI（依 ADK 版本功能而定）
    Runner(root_agent).run()
