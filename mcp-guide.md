# Hướng dẫn sử dụng lệnh `claude mcp`

## Tổng quan

MCP (Model Context Protocol) cho phép Claude kết nối với các server bên ngoài để có thêm tools (đọc file, gọi API, truy vấn DB, v.v.).

---

## 1. Xem danh sách server

```bash
/mcp
# hoặc
claude mcp list
```

---

## 2. Thêm MCP server — `claude mcp add`

### Cú pháp chung

```bash
claude mcp add [options] <tên> <command> [args...]
```

### Options

| Flag | Mô tả | Mặc định |
|---|---|---|
| `-s, --scope <scope>` | Phạm vi: `local`, `project`, `global` | `local` |
| `--transport <type>` | Loại kết nối: `stdio`, `sse`, `http` | `stdio` |
| `-e, --env KEY=VALUE` | Biến môi trường (dùng nhiều lần được) | — |
| `-H, --header KEY=VALUE` | HTTP header (dùng cho sse/http) | — |

### Scope

- `local` — chỉ lưu cho phiên hiện tại (không commit lên git)
- `project` — lưu vào `.mcp.json` trong project (chia sẻ qua git)
- `global` — lưu vào `~/.claude/claude.json` (dùng cho mọi project)

---

## 3. Ví dụ thực tế

### Filesystem server (đọc/ghi file)

```bash
claude mcp add --scope project files npx -y @modelcontextprotocol/server-filesystem D:\were-wolf
```

### Fetch server (gọi HTTP/web)

```bash
claude mcp add --scope project web-fetch npx -y @modelcontextprotocol/server-fetch
```

### PostgreSQL server

```bash
claude mcp add --scope project db npx -y @modelcontextprotocol/server-postgres postgresql://user:pass@localhost:5432/mydb
```

### GitHub server

```bash
claude mcp add --scope global github npx -y @modelcontextprotocol/server-github \
  -e GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxxxxxxxxxx
```

### Server dạng SSE (HTTP streaming)

```bash
claude mcp add --transport sse my-remote-server https://example.com/mcp/sse
```

### Server dạng HTTP

```bash
claude mcp add --transport http my-api-server https://example.com/mcp \
  -H Authorization="Bearer token123"
```

---

## 4. Xóa server

```bash
claude mcp remove <tên>
```

---

## 5. Chỉnh sửa thủ công `.mcp.json`

Thay vì dùng lệnh, có thể sửa trực tiếp file `.mcp.json` ở root project:

```json
{
  "mcpServers": {
    "files": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "D:\\were-wolf"],
      "env": {}
    },
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxx"
      }
    }
  }
}
```

> **Lưu ý:** Dùng `\\` thay vì `\` trong JSON trên Windows.

---

## 6. Kiểm tra lỗi

```bash
/doctor
```

Lệnh này kiểm tra toàn bộ cấu hình Claude Code, bao gồm các MCP server bị lỗi kết nối.

---

## Tài liệu chính thức

- https://code.claude.com/docs/en/mcp
- `claude mcp --help`
