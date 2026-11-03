from google.adk.agents import Agent
from google.adk.models import LiteLlm
from google.adk.tools.mcp_tool import McpToolset, StdioConnectionParams
from mcp import StdioServerParameters

toolset=McpToolset(
     connection_params=StdioConnectionParams(
         server_params=StdioServerParameters(
             command="python",
             args=["mcp_agent\\server.py"]
         )
     )
)

root_agent=Agent(
    name="HeathAgent",
    instruction="你是一個健康管理師",
    description="這個 Agent 專注於健康管理，並提供相關的建議與指導。",
    model=LiteLlm(model="deepseek/deepseek-chat"),
    tools=[toolset]
)