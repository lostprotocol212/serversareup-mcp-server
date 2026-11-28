# @serversareup/mcp-server (`v0.3.0`)

[![MCP Ready — 129 Scoped Tools](https://serversareup.com/api/badges/mcp-ready)](https://serversareup.com/mcp)
[![Servers Are Up Status](https://serversareup.com/api/badges/status)](https://serversareup.com/status)
[![Cloud VPS — US KVM Compute](https://serversareup.com/api/badges/cloud-vps)](https://serversareup.com/pricing)

Discoverable on [Glama MCP Servers](https://glama.ai/mcp/servers) · Source mirror at [lostprotocol212/serversareup-mcp-server](https://github.com/lostprotocol212/serversareup-mcp-server).

Model Context Protocol (MCP) server for managing [Servers Are Up](https://serversareup.com) virtual machines, Docker containers, Virtual Datacenters, multiplayer game servers, connected hybrid machines, **SAU Resource Manager**, **Managed Cloud Storage Hosted via Microsoft Azure**, Multi-Model Cloud Databases, Secrets Vault, Cloud SIEM, and `112` Cloud & Managed SaaS services from AI assistants.

Requires **Node.js 20 or later**. Install the standalone stdio server from npm or directly from the verified tarball, or connect directly to the hosted HTTP endpoint with zero local installation:

```bash
npm install -g @serversareup/mcp-server
# or direct verified build from Servers Are Up:
npm install -g https://serversareup.com/downloads/serversareup-mcp-server.tgz
```

## Hosted Streamable HTTP Connection (`141` Tools + Per-Environment Tenant MCP)

Claude Code, Codex CLI, Cursor, and other clients that support Streamable HTTP bearer headers can connect to `https://serversareup.com/api/mcp/v1` (account-wide) or to an isolated **Customer Environment Tenant MCP Server** at `https://serversareup.com/api/mcp/v1/environments/{envId}` using a scoped `sau_tmcp_...` token with per-environment write guardrails (`READ_ONLY`, `SCOPED_WRITE`, `PIM_GATED_WRITE`), tool-group scoping, Cloud Identity/PIM/B2B, Cloud SIEM, Edge Gateways, Compliance, Monitoring, and Plugins:

```json
{
  "mcpServers": {
    "serversareup": {
      "type": "http",
      "url": "https://serversareup.com/api/mcp/v1",
      "headers": { "Authorization": "Bearer ${SAU_API_TOKEN}" }
    }
  }
}
```

With Codex CLI or Claude Code:

```bash
codex mcp add serversareup --url https://serversareup.com/api/mcp/v1 --bearer-token-env-var SAU_API_TOKEN
claude mcp add --transport http serversareup https://serversareup.com/api/mcp/v1
```

Or run the containerized stdio bridge from GitHub Container Registry (`GHCR`):

```bash
docker run -i --rm -e SAU_API_TOKEN="sau_your_token" ghcr.io/lostprotocol212/serversareup-mcp-server:latest
```

Keep the actual token out of source files and shell history. Connections on tokens requiring approval must be approved by the account owner in the dashboard before tool calls work, and Cloud Platform mutations respect active `CanNotDelete` / `ReadOnly` Management Locks plus the environment's **AI Agent Write Guardrail** (`READ_ONLY`, `SAFE_MUTATIONS`, `FULL_AUTONOMOUS`). See the [complete hosted MCP reference](https://serversareup.com/docs/mcp).

## Standalone Stdio Quick Start (`43` Tools)

### 1. Create a Scoped API Token

Generate a Personal Access Token or Organization API key at [https://serversareup.com/account/api-keys](https://serversareup.com/account/api-keys).

Common scopes: `instances:read`, `instances:write`, `instances:power`, `instances:exec`, `ssh-keys:read`, `ssh-keys:write`, `cloud:read`, `cloud:write`.

### 2. Configure Your AI Assistant

**Cursor** (`.cursor/mcp.json`) or **Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "serversareup": {
      "command": "serversareup-mcp",
      "env": {
        "SAU_API_TOKEN": "sau_your_token"
      }
    }
  }
}
```

**VS Code** (`.vscode/mcp.json`):

```json
{
  "servers": {
    "serversareup": {
      "command": "serversareup-mcp",
      "env": {
        "SAU_API_TOKEN": "sau_your_token"
      }
    }
  }
}
```

## Available Stdio Tools (`40` Tools)

| Tool | Description |
|------|-------------|
| `get_catalog` | Browse products, pricing, purchase configuration, and current terms/privacy identifiers |
| `list_backup_sources` | List owned managed Linux data volumes and lineage IDs for backup policy checkout |
| `quote_backup_policy` | Read-only source/tier/price check and unaccepted order draft |
| `create_order` / `get_order` | Submit an authorized purchase (`Idempotency-Key`) and poll payment/provisioning status |
| `list_instances` / `get_instance` | List owned instances or inspect full instance specs, IPs, tags, and status |
| `start_instance` / `stop_instance` / `reboot_instance` / `reset_instance` | Instance power lifecycle controls |
| `rename_instance` / `tag_instance` | Update display `name` or replace `tags` via `PATCH /api/v1/instances/{id}` (note: `set_hostname` is legacy; OpenStack instances reject API `hostname` patches with `400` — use `rename_instance`) |
| `delete_instance` | Soft-delete to the 30-day recycle bin by default, or irreversible cleanup with `permanent: true` |
| `get_instance_access` | Published SSH/RDP/app endpoints and host-key pin (`include_credentials` requires `instances:exec`) |
| `exec_instance` / `get_game_operation` | Execute guest commands (`instances:exec`) and poll queued game operation receipts |
| `read_instance_file` / `write_instance_file` | Read or replace UTF-8 guest files (`instances:files:read` / `instances:files:write`) |
| `list_ssh_keys` / `add_ssh_key` / `delete_ssh_key` | Manage account SSH public keys |
| `list_snapshots` / `create_snapshot` | List or create point-in-time instance snapshots (`202 Accepted`) |
| `list_checkpoints` / `create_checkpoint` / `restore_checkpoint` | List, create, or restore Virtual Datacenter network configuration checkpoints |
| `get_account` | View account summary, plan, and resource counts |
| `get_resource_manager` / `manage_resource_manager` | Inspect or manage Resource Groups, Tags, Locks, RBAC, Diagnostics, Quotas, Portal/CLI settings, AI Write Guardrails, and `ARM_JSON` / `TERRAFORM_HCL` exports (`cloud:read` / `cloud:write`) |
| `list_cloud_saas_services` / `manage_cloud_saas_subscription` | Browse or subscribe/cancel across `112` Cloud & Managed SaaS offerings |
| `get_cosmos_databases` / `manage_cosmos_database` | Inspect and operate SAU Multi-Model Cloud Databases (Document JSONB, Vector AI, Key-Value) |
| `get_key_vault_secrets` / `set_key_vault_secret` | List, read, or write versioned encrypted secrets in SAU Secrets Vault |
| `get_sentinel_workspace` / `manage_sentinel_workspace` | Run Cloud SIEM KQL threat-hunting queries, triage incidents, and manage SOAR playbooks |
| `inspect_cloud_service_plane` / `operate_cloud_service_plane` | Unified read/write across `blob-storage` (Managed Cloud Storage via Microsoft Azure), `container-registry`, `cloud-dns`, `recovery-vault`, `access gateway`, `defender-purview`, `entra-suite`, `serverless-compute`, `iot-chaos`, `app-config`, `service-bus`, `workflows`, `governance`, and `apim` |
| `list_updates` / `get_update_policy` / `set_update_policy` / `apply_update` / `rollback_update` | Inspect software/OS/product/service versions, configure auto-update policies (platform ON, apps OFF by default), apply updates, and roll back via checkpoints (`/api/v1/updates`) |

Instances are also exposed as MCP resources at `sau://instances/{id}`.

## Official Documentation & Ecosystem Links

- **MCP Overview & Server Card**: [https://serversareup.com/mcp](https://serversareup.com/mcp) (`https://serversareup.com/.well-known/mcp/server-card.json`)
- **Hosted MCP & API Reference**: [https://serversareup.com/docs/mcp](https://serversareup.com/docs/mcp) & [https://serversareup.com/api/v1/openapi](https://serversareup.com/api/v1/openapi)
- **Public Guide Library (`MCP with an AI Agent`)**: [https://serversareup.com/docs/products/mcp-with-an-ai-agent](https://serversareup.com/docs/products/mcp-with-an-ai-agent)
- **Managed Cloud Storage (Azure-Backed)**: [https://serversareup.com/cloud-storage](https://serversareup.com/cloud-storage)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SAU_API_TOKEN` | Yes | — | Scoped Personal or Organization Access Token (`sau_...`) |
| `SAU_API_BASE` | No | `https://serversareup.com` | API base URL |

## License

MIT
