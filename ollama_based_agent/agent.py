import os
from pathlib import Path

from google.adk.agents import Agent
from google.adk.models import LiteLlm
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from dotenv import load_dotenv

load_dotenv()

os.environ["LITELLM_LOCAL_MODEL_COST_MAP"] = "True"

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

jarvis_agent=Agent(
    name="jarvis_agent",
    instruction=(
        "you are an assistant like Jarvis from iron man, but funnier and smarter, "
        "and return **ONLY** the result without extra bullshit, and the language is " 
        "always in uppercase Chinese"
    ),
    description="An assistant like Jarvis from Iron Man, but funnier and smarter",
    model=LiteLlm(
        model= "openai/glm4:9b",
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
                types.Part.from_text(text="please extract the text from given image, nothing more"),
                types.Part.from_bytes(
                    data=(Path(__file__).parent / "images" / "ad.png").read_bytes(),
                    mime_type="image/png",
                ),
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

async def another_main():   

    USER_ID="user_123"
    APP_NAME="DEMO_APP"
    
    session_service=InMemorySessionService()
    session=await session_service.create_session(
        app_name=APP_NAME,
        user_id=USER_ID
    )

    runner=Runner(
        app_name=APP_NAME,
        agent=jarvis_agent,
        session_service=session_service
    )

    while True:
        user_prompt = input("You: ")
        if user_prompt.lower() in ["exit", "quit"]:
            break
        events=runner.run_async(
            user_id=session.user_id,
            session_id=session.id,
            new_message=types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=user_prompt),
                ]
            )
        )

        async for event in events:
            if event.content and event.content.parts and len(event.content.parts) > 0  :
                for part in event.content.parts:
                    if part.thought: continue
                    print(f"\x1b[32mBot:{part.text}\x1b[0m")
            else:
                print("No content received.")

if __name__=="__main__":
    import asyncio
    asyncio.run(another_main())