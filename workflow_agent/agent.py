import os

from dotenv import load_dotenv
from google.adk import Workflow,Agent,Context
from google.adk.workflow import node
from google.genai import types
from google.adk.models.lite_llm import LiteLlm

load_dotenv()

@node
def math_question(ctx) -> str:
    content=getattr(ctx,"user_content")
    return str(content).upper()

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
    ctx.state["hello_input"] = node_input
    return "hello_done"

def goodbye(ctx:Context, node_input:str) -> str:
    ctx.state["goodbye_input"] = node_input
    return "goodbye_done"

def process(ctx:Context) -> str:
    hello_input = ctx.state.get("hello_input", "")
    goodbye_input = ctx.state.get("goodbye_input", "")
    return f"Hello: {hello_input}, Goodbye: {goodbye_input}"

root_agent = Workflow(
	name="hello_world_workflow",
	edges=[
        ("START", math_question),
        (math_question,receiver_agent),
        (receiver_agent, hello),
        (receiver_agent, goodbye),
        (goodbye, process),
        (hello, process)
    ],
)