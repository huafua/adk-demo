import asyncio

from google.genai import types
from google.adk.agents import Agent
from google.adk.models import LiteLlm
from google.adk.sessions import InMemorySessionService
from google.adk.runners import Runner


# 建立根代理，設定名稱、指令、描述及使用的模型
root_agent=Agent(
    name="TeacherAgent",
    instruction="你是一個由 DeepSeek 驅動的經驗豐富的前端框架React教師助手，請使用正體中文回答問題",
    description="這個 Agent 專注於教授前端框架 React 的知識，並提供相關的教學與指導。",
    model=LiteLlm(model="deepseek/deepseek-flash")
)

async def main():
    """
    主函式，負責與使用者互動，建立會話，並運行代理。
    """

    # 1. 取得使用者輸入的提示訊息
    user_prompt = input("User: ").strip()
    if user_prompt.lower() in ["exit", "quit"]:
        return
    if not user_prompt:
        print("User prompt cannot be empty.")
        return
    # Here you would typically run the agent with the user_prompt
    print(f"Running agent with prompt: {user_prompt}")

    # 2. 設定使用者與會話資訊
    USER_ID="user_123"
    SESSION_ID="session_123"

    # 3. 建立會話服務並創建會話
    session_service = InMemorySessionService()
    session=await session_service.create_session(
        app_name="demo_app",
        user_id=USER_ID,
        session_id=SESSION_ID
    )

    # 4. 建立 Runner 並運行代理
    runner=Runner(
        app_name="demo_app",
        agent=root_agent,
        session_service=session_service
    )

    # 5. 以非同步方式運行事件迴圈，處理代理回應
    events = runner.run_async(
        user_id=session.user_id,
        session_id=session.id,
        new_message=types.Content(
            role="user",
            parts=[types.Part.from_text(text=user_prompt)]
        )
    )

    # 6. 處理代理回應事件
    async for event in events:
        if event.content and event.content.parts:
            for part in event.content.parts:
                print(f"Agent:{event.author},Content: {part.text}")


# 程式進入點，啟動非同步主函式
if __name__=="__main__":
    asyncio.run(main())