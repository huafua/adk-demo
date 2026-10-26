import os
import asyncio 

from dotenv import load_dotenv
from google.adk import Workflow,Agent,Context
from google.adk.workflow import node,JoinNode
from google.genai import types
from google.adk.sessions import InMemorySessionService
from google.adk.models.lite_llm import LiteLlm
from google.adk.runners import Runner

load_dotenv()

# 設定 LiteLLM 本地模型成本映射環境變數
os.environ["LITELLM_LOCAL_MODEL_COST_MAP"]="True"

@node
def math_question(ctx:Context) -> str:
    """
    節點函式，用於處理數學問題。
    """
    content=getattr(ctx,"user_content")
    print("math_question_node encoutered!")
    return str(content).upper()


# 建立接收者代理，設定名稱、模型、指令及描述
receiver_agent=Agent(
    name="receiver_agent",
    model=LiteLlm(
        model="deepseek/deepseek-flash",
        api_key=os.getenv("DEEPSEEK_API_KEY"),
        api_base=os.getenv("DEEPSEEK_API_BASE")
    ),
    instruction="You are a high school math teacher",
    description="You are a high school math teacher, and you help students understand and solve math problems. RETURN **ONLY** RESULT, for example when user asks what's one plus two, return 3 **ONLY**"
)


def hello(ctx:Context,node_input:str) -> str:
    """
    節點函式，用於處理 hello 節點的邏輯。
    Args:
        ctx (Context): 節點上下文物件，包含狀態與使用者內容。
        node_input (str): 從前一個節點傳遞過來的輸入字串。
    Returns:
        str: 節點處理結果的字串。
    """
    ctx.state["hello_input"] = node_input
    print("hello_node encountered!")
    return "hello_done"

def goodbye(ctx:Context, node_input:str) -> str:
    """
    節點函式，用於處理 goodbye 節點的邏輯。
    Args:
        ctx (Context): 節點上下文物件，包含狀態與使用者內容。
        node_input (str): 從前一個節點傳遞過來的輸入字串。
    Returns:
        str: 節點處理結果的字串。
    """
    ctx.state["goodbye_input"] = node_input
    print("goodbye_node encountered!")
    return "goodbye_done"

def process(ctx:Context) -> str:
    """
    節點函式，用於處理 process 節點的邏輯。
    Args:
        ctx (Context): 節點上下文物件，包含狀態與使用者內容。
    Returns:
        str: 節點處理結果的字串。
    """
    hello_input = ctx.state.get("hello_input", "")
    goodbye_input = ctx.state.get("goodbye_input", "")
    print("process_node encountered!")
    return f"Hello: {hello_input}, Goodbye: {goodbye_input}"

# 這個節點用於收集多個分支的輸入，並在所有分支完成後再進行後續處理
joint=JoinNode(name="collect_data")

# 建立工作流程代理，定義節點之間的邊與流程。
root_agent = Workflow(
	name="hello_world_workflow",
	edges=[
        ("START", math_question),
        (math_question,receiver_agent),
        (receiver_agent, hello),
        (receiver_agent, goodbye),
        (goodbye, joint),
        (hello, joint),
        # 將多個分支的輸入收集到 joint 節點，再進行後續處理
        (joint, process)
    ],
)

async def main(user_prompt:str):
    """
    主函式，負責運行工作流程代理，處理使用者輸入的提示訊息。

    Args:
        user_prompt (str): 使用者輸入的提示訊息。
    """
    if user_prompt is None or user_prompt.strip() == "":
        return print("User prompt cannot be empty.")
    # 1. 設定使用者與會話資訊
    USER_ID="user_123"
    SESSION_ID="session_123"

    # 2. 建立會話服務並創建會話
    session_service = InMemorySessionService()

    # 3. 創建會話並取得會話物件
    session=await session_service.create_session(
        app_name="workflow_app",
        user_id=USER_ID,
        session_id= SESSION_ID
    )

    # 4. 建立 Runner 並運行代理
    runner = Runner(
        app_name="workflow_app", 
        node=root_agent, 
        session_service=session_service
    )

    # 5. 以非同步方式運行事件迴圈，處理代理回應
    events=runner.run_async(
        user_id=USER_ID,
        session_id=session.id,
        new_message=types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=user_prompt)
            ]
        )
    )

    # 6. 處理代理回應事件
    async for event in events:
        if event.content and event.content.parts:
            for part in event.content.parts:
                    print(event.author,part.text)
    
if __name__=="__main__":
    # 7. 提示使用者輸入訊息，並呼叫主函式處理輸入。
    while True:
        user_prompt = input("User: ").strip()
        if user_prompt.lower() in ["exit", "quit"]:
            break
        asyncio.run(main(user_prompt))