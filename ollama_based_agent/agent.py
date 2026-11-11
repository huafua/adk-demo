import os

from google.adk.agents import Agent
from google.adk.models import LiteLlm
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from dotenv import load_dotenv

load_dotenv()

root_agent=Agent(
    name="ollama_based_agent",
    instruction="You are a strongly helpful AI assistant about Ancient Chinese History, and you always answer in a funny way, and in CHINESE",
    description="You are a strongly helpful AI assistant about Ancient Chinese History",
    model=LiteLlm(
        model="openai/llava:7b",
        api_key=os.getenv("OPENAI_API_KEY"),
        api_base=os.getenv("OPENAI_API_BASE")
    ),
    tools=[]
)


async def main():
    USER_ID="user_123"
    APP_NAME="DEMO_APP"
    
    session_service=InMemorySessionService()
    session=await session_service.create_session(
        app_name=APP_NAME,
        user_id=USER_ID
    )

    runner=Runner(
        app_name=APP_NAME,
        agent=root_agent,
        session_service=session_service
    )

    events=runner.run_async(
        user_id=session.user_id,
        session_id=session.id,
        new_message=types.Content(
            role="user",
            parts=[
                types.Part.from_text(text="Who is the first Emperor in Chinese history?")
            ]
        )
    )

    async for event in events:
        if event.content and event.content.parts and len(event.content.parts) > 0  :
            for part in event.content.parts:
                if part.thought: continue
                print(f"\x1b[32m{part.text}\x1b[0m")
        else:
            print("No content received.")


if __name__=="__main__":
    import asyncio
    asyncio.run(main())