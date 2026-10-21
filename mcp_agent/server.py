from fastmcp import FastMCP

# 1. 初始化 FastMCP
mcp = FastMCP("My Awesome Server")

# 2. 註冊一個工具 (LLM 可呼叫的函式)
@mcp.tool()
def calculate_bmi(weight_kg: float, height_m: float) -> str:
    """計算並返回 BMI 指數。"""
    bmi = weight_kg / (height_m ** 2)
    return f"夥計，你的BMI 是 {bmi:.2f}"

# 3. 運行伺服器
if __name__ == "__main__":
    mcp.run(transport="stdio")
