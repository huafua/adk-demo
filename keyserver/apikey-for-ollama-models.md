# Nginx 反向代理为 Ollama LLM 提供 API Key 校验

本文档说明如何使用 Nginx 反向代理结合 Node.js 认证服务，为 Ollama LLM 模型 API 提供 API Key 校验机制。

## 整体架构

```
┌──────────────────┐
│  Python Agent    │ (使用 LiteLlm 调用 LLM)
│  (agent.py)      │
└────────┬─────────┘
         │
         │ HTTP 请求
         │ Authorization: Bearer sk-xxx
         │
    ┌────▼───────────────────────┐
    │  Nginx                     │
    │  (反向代理)                 │
    │  (ollama-auth.conf)        │
    └──┬─────────────────────┬───┘
       │                     │
       │ auth_               │ 转发请求
       │ request             │
       │                     │
   ┌───▼──────────────┐   ┌──▼───────────────┐
   │Node JS           │   │ Ollama (LLM)     │
   │认证服务           │   │ localhost:11434  │
   │(auth-service.js) │   │ /v1/*            │
   │(3000)            │   └──────────────────┘
   └──────────────────┘
```

## 源代码详解

### 1. Nginx 配置文件 (ollama-auth.conf)

```nginx
server{
    listen 81;
    server_name localhost;
    
    location /llm/ {
        auth_request /auth/;
        proxy_pass http://localhost:11434/v1/;
    }

    location /auth/ {
        proxy_pass http://localhost:3000/auth;
    }
}
```

**核心配置说明：**

- **listen 81** - 监听 81 端口
- **location /llm/** - LLM 请求的入口
  - `auth_request /auth/` - 先向 `/auth/` 位置发起认证请求
  - `proxy_pass http://localhost:11434/v1/` - 认证通过后转发给 Ollama
- **location /auth/** - 认证服务的入口
  - `proxy_pass http://localhost:3000/auth` - 转发给 Node.js 认证服务

**工作流程：**

1. 客户端请求 `/llm/models` → Nginx 收到请求
2. Nginx 先执行 `auth_request /auth/` 进行认证
3. `/auth/` 被转发到 Node.js 服务的 `/auth` 端点进行校验
4. 认证通过 (200) → 转发原请求到 Ollama `/v1/models`
5. 认证失败 (401/403) → 返回错误，不转发到 Ollama

### 2. Node.js 认证服务 (auth-service.js)

```javascript
const http = require("http")

const validApiKeys = [
    'sk-d6ved24isinrd2g43wbyvd93arqk4cnx',
    'sk-jkoez8xfda0x4rcwwqbmthhu8zmdn7l9',
    'sk-o5i67lybgadcnye1khbqknqyrdmcapph',
    'sk-n408h3435p2sjgrtgjysipjj7sezc2jh',
    'sk-7nydp7jy3gtngdxb19d543pm3ktbhdcf',
    'sk-en5oj81l24s7w6jcc7rtosx9q16nx74o',
    'sk-gnyh2cytv2nx7ibak3cjjlmndwiv3d79',
    'sk-4zjchqapg1li1ltbwqxp9zuc31mu90gz',
    'sk-8jv1ifz5hgwl6triqjedt9ujdoymx827',
    'sk-kfxz3sot2f27173u7iyasq6j2g48ib7i',
    'sk-de4pker8o1b7ok84f4r187dcgtbjg7k1',
    'sk-i3aar9diskboiv83hz29g31y0ylb5d4y',
    'sk-92cnp88i73l9oi0ipf852ekb9m3ifx1q',
    'sk-21ijzxfw2fyf79r3wd1yg86270h7u7rf',
    'sk-17p9fzr9hu074ganqi2kbczv43pazlnp',
    'sk-7oz9yqfr0xcq5k2knwsclxk17ihb8mtf',
    'sk-fq5fyxzknkwljfou72jkzeuf25ryvy6c',
    'sk-y6l5os6vqkjd7xuhshxl1c5kz65c3u8z',
    'sk-arftt7coqberjqsqw3z3p4stbpc62qs8',
    'sk-cx6gcgtxmb3u0g53f7cs389174zmfmri'
]

http.createServer((req, res) => {
    let urlObject = new URL(req.url, `http://${req.headers.host}`)
    if (urlObject.pathname.startsWith("/auth")) {
        let authorization = req.headers["authorization"];
        if (!authorization) {
            res.writeHead(401, { 'Content-Type': 'text/plain' });
            return res.end("Authorization required");
        }
        authorization = authorization.replace("Bearer ", "");
        if (!validApiKeys.includes(authorization)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            return res.end(`Authorization is not valid - '${authorization}'`);
        }
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end(`Authorization past - ${authorization}`);
    }
    if (urlObject.pathname.startsWith("/llm")) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end("LLM Endpoint");
    }
    res.end();
}).listen(3000, () => {
    console.log(`\x1b[33m ${new Date().toISOString()}: Server running at http://localhost:3000/\x1b[0m`);
});
```

**认证服务逻辑：**

1. **检查 Authorization Header**
   ```javascript
   let authorization = req.headers["authorization"];
   if (!authorization) {
       res.writeHead(401);  // 缺少 Authorization 返回 401
       return res.end("Authorization required");
   }
   ```

2. **提取 Bearer Token**
   ```javascript
   authorization = authorization.replace("Bearer ", "");
   // "Authorization: Bearer sk-xxx" → "sk-xxx"
   ```

3. **验证 API Key**
   ```javascript
   if (!validApiKeys.includes(authorization)) {
       res.writeHead(403);  // 密钥无效返回 403
       return res.end(`Authorization is not valid - '${authorization}'`);
   }
   ```

4. **认证通过**
   ```javascript
   res.writeHead(200);
   return res.end(`Authorization past - ${authorization}`);
   ```

**状态码含义：**
- `200 OK` - 认证通过，Nginx 继续处理请求
- `401 Unauthorized` - 缺少认证信息
- `403 Forbidden` - 认证信息无效

### 3. Python Agent 调用 (agent.py)

```python
import os

from google.adk.agents import Agent
from google.adk.models import LiteLlm
from google.adk.sessions import InMemorySessionService
from google.adk.runners import Runner
from google.genai import types

os.environ["LITELLM_LOCAL_MODEL_COST_MAP"]="True"

root_agent = Agent(
    name='root_agent',
    model=LiteLlm(
        model='openai/llava:7b',
        api_key="sk-4zjchqapg1li1ltbwqxp9zuc31mu90gz",
        api_base="http://localhost:81/llm/"
    ),
    instruction='Answer user questions to the best of your knowledge',
    description='A helpful assistant for user questions.',
)

async def main():
    USER_ID = "user_123"
    APP_NAME = "demo_app"
    session_service = InMemorySessionService()
    session = await session_service.create_session(
        app_name=APP_NAME,
        user_id=USER_ID
    )
    runner = Runner(
        app_name=APP_NAME,
        agent=root_agent,
        session_service=session_service        
    )

    events = runner.run_async(
        user_id=session.user_id,
        session_id=session.id,
        new_message=types.Content(
            role="user",
            parts=[
                types.Part.from_text(text="What's eight plus eleven?")
            ]
        )
    )

    async for event in events:
        if event.content and event.content.parts and len(event.content.parts) > 0:
            for part in event.content.parts:
                if part.thought: continue
                print(f"\x1b[32m[{event.author}]:{part.text}\x1b[0m")


if __name__=="__main__":
    import asyncio
    asyncio.run(main())
```

**关键配置：**

- **api_key** - 必须是 `validApiKeys` 中的有效密钥
  ```python
  api_key="sk-4zjchqapg1li1ltbwqxp9zuc31mu90gz"
  ```

- **api_base** - 指向 Nginx 反向代理地址
  ```python
  api_base="http://localhost:81/llm/"
  ```

- **LiteLlm 工作流程：**
  1. 接收用户问题
  2. 自动添加 `Authorization: Bearer sk-4zjchqapg1li1ltbwqxp9zuc31mu90gz` Header
  3. 发送 HTTP 请求到 `http://localhost:81/llm/v1/chat/completions`
  4. Nginx 先校验 API Key
  5. 认证通过后转发到 Ollama
  6. 返回响应给 Agent

## 请求流程图

### 成功的请求流程

```
Python Agent
    │
    │ POST /llm/v1/chat/completions
    │ Authorization: Bearer sk-4zjchqapg1li1ltbwqxp9zuc31mu90gz
    │
    ▼
Nginx (81 端口)
    │
    ├─→ auth_request /auth/
    │   │
    │   ▼
    │   转发到 http://localhost:3000/auth
    │   (Node.js 检查 Header)
    │
    │   返回 200 OK
    │   ✓ 认证通过
    │
    ├─→ proxy_pass http://localhost:11434/v1/
    │
    ▼
Ollama LLM (11434 端口)
    │
    ▼
处理请求 + 返回结果
    │
    ▼
Python Agent 收到响应
```

### 失败的请求流程

```
Python Agent
    │
    │ POST /llm/v1/chat/completions
    │ Authorization: Bearer invalid-key
    │
    ▼
Nginx (81 端口)
    │
    ├─→ auth_request /auth/
    │   │
    │   ▼
    │   转发到 http://localhost:3000/auth
    │   (Node.js 检查 Header)
    │
    │   返回 403 Forbidden
    │   ✗ 认证失败
    │
    ├─→ 停止处理，不转发到 Ollama
    │
    ▼
返回 403 Forbidden 给客户端
```

## 安装和运行

### 1. 启动 Node.js 认证服务

```bash
cd d:\Applications\nginx-1.30.6\conf
node auth-service.js
```

输出：
```
2026-11-13T06:30:00.000Z: Server running at http://localhost:3000/
```

### 2. 启动 Ollama (假设已安装)

```bash
ollama serve
# Ollama 监听在 http://localhost:11434
```

### 3. 启动 Nginx

编辑 Nginx 配置使用 `ollama-auth.conf`：

```bash
cd d:\Applications\nginx-1.30.6
nginx -c conf/ollama-auth.conf
```

### 4. 运行 Python Agent

```bash
python demo_agent/agent.py
```

## 使用 curl 测试

### 测试有效的 API Key

```bash
curl -i -H "Authorization: Bearer sk-4zjchqapg1li1ltbwqxp9zuc31mu90gz" http://localhost:81/llm/models
```

响应（来自 Ollama）：
```
HTTP/1.1 200 OK
...
{"object":"list","data":[...]}
```

### 测试无效的 API Key

```bash
curl -i -H "Authorization: Bearer invalid-key" http://localhost:81/llm/models
```

响应：
```
HTTP/1.1 403 Forbidden
Authorization is not valid - 'invalid-key'
```

### 测试缺少 Authorization

```bash
curl -i http://localhost:81/llm/v1/models
```

响应：
```
HTTP/1.1 401 Unauthorized
Authorization required
```

## 安全性考虑

### 1. API Key 管理
- ✅ API Key 存储在服务器内存中
- ⚠️ 生产环境应该：
  - 存储在数据库中
  - 使用哈希算法保存（不存储明文）
  - 使用环境变量或密钥管理服务

### 2. 加密传输
- ⚠️ 当前使用 HTTP，生产环境应该：
  - 使用 HTTPS/SSL
  - 配置 Nginx SSL 证书
  - 启用 TLS 1.2+

### 3. 速率限制
- ⚠️ 当前没有速率限制，应该：
  - 在 Nginx 中配置 `limit_req`
  - 按 API Key 进行速率限制
  - 防止 DDoS 攻击

### 4. 日志记录
- ⚠️ 当前没有详细日志，应该：
  - 记录所有认证请求
  - 记录失败的认证尝试
  - 便于审计和排查


## 常见问题

### Q: 为什么 Nginx 需要先验证再转发？

A: 这叫做"认证网关"模式，优点：
- 保护后端 Ollama 服务不被非法访问
- 集中管理认证逻辑
- 不需要修改 Ollama 代码
- 可以灵活添加认证、日志、速率限制等

### Q: auth_request 返回非 200 的状态码会怎样？

A: Nginx 会：
1. 停止处理原请求
2. 返回认证失败的状态码给客户端
3. 不转发到后端 Ollama
4. 所以 Ollama 完全看不到非法请求

### Q: 如何在 Nginx 中记录认证信息？

A: 添加到 `ollama-auth.conf`：

```nginx
location /llm/ {
    auth_request /auth/;
    auth_request_set $auth_status $upstream_status;
    proxy_pass http://localhost:11434/v1/;
    access_log /path/to/llm-access.log '$remote_addr - [$time_local] "$request" $auth_status';
}
```

### Q: 如何限制特定 IP 访问？

A: 在 location 中添加：

```nginx
location /llm/ {
    allow 192.168.1.0/24;
    allow 127.0.0.1;
    deny all;
    auth_request /auth/;
    proxy_pass http://localhost:11434/v1/;
}
```

## 总结

这个方案展示了如何：

1. **使用 Nginx `auth_request`** - 在转发前进行认证
2. **Node.js 认证服务** - 灵活的、可扩展的认证逻辑
3. **保护 Ollama LLM** - 仅允许有效 API Key 访问
4. **无缝集成 Python Agent** - 使用 LiteLlm 自动添加认证 Header

这种"网关认证"模式在微服务架构中非常常见，可以保护任何后端服务。
