
from google.adk.agents import Agent
from google.adk.models.lite_llm import LiteLlm
import os

root_agent=Agent(
    name="TeacherAgent",
    instruction="你是一個由 DeepSeek 驅動的經驗豐富的前端框架React教師助手，請使用正體中文回答問題",
    description="這個 Agent 專注於教授前端框架 React 的知識，並提供相關的教學與指導。",
    model=LiteLlm(
        model="deepseek/deepseek-chat",
        api_key=os.getenv("DEEPSEEK_API_KEY"),
        api_base=os.getenv("DEEPSEEK_API_BASE")
    )
)