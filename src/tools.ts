/**
 * MCP Tool Definitions
 *
 * Each tool represents an action AI assistants can take on the SAU platform.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const TOOLS: Tool[] = [
  { name: 'get_game_operation', description: 'Poll an owned game command/file operation without resubmitting it. Requires the original operation’s scope. Pending is not failure; completed commands preserve stdout, stderr and success.', annotations: { readOnlyHint: true, idempotentHint: true }, inputSchema: { type: 'object', required: ['id', 'operation_id'], properties: { id: { type: 'string' }, operation_id: { type: 'string', minLength: 1, maxLength: 128 } }, additionalProperties: false } },
  {
    name: 'delete_instance',
    description: 'Requires instances:write. Recycle an owned instance by default. permanent:true irreversibly removes a stopped instance and all its retained resources through verified worker cleanup; use only when the customer authorized permanent deletion. Reuse idempotency_key on retries. Poll get_instance for cleanup status.',
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    inputSchema: { type: 'object', required: ['id'], additionalProperties: false,
      properties: { id: { type: 'string' }, permanent: { type: 'boolean', default: false }, idempotency_key: { type: 'string' } } },
  },
  {
    name: 'quote_backup_policy',
    description: 'Read-only source-specific backup quote. Requires instances:read. Checks owned source generation, size cap, retention acceptance, current monthly Stripe price and existing policy/checkout holds. Returns an unaccepted order draft; does not reserve capacity, accept terms, create an order or charge. Use list_backup_sources to find lineage_id.',
    annotations: { readOnlyHint: true, idempotentHint: true },
    inputSchema: { type: 'object', required: ['product_slug', 'lineage_id'],
      properties: { product_slug: { type: 'string' }, lineage_id: { type: 'string' } }, additionalProperties: false },
  },
  {
    name: 'list_backup_sources',
    description: 'List owned managed Linux data volumes for a backup policy purchase. Requires instances:read and respects the token organization. Use the returned lineageId as item.configuration.lineageId when creating a backup order. Compare sizeGiB with the catalog tier cap; checkout independently verifies current backend acceptance. Backup policies require quantity 1, billingInterval month and useCredits false. This tool does not purchase or create a backup.',
    annotations: { readOnlyHint: true, idempotentHint: true },
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_catalog',
    description: 'Browse all products, pricing, purchase configuration and current terms/privacy versions. Read the linked terms and obtain the account holder\'s authorization before creating an order.',
    annotations: { readOnlyHint: true },
    inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['INSTANCE_PLAN', 'INSTANT_APP', 'ADDON', 'BACKUP', 'TEMPLATE'] } } },
  },
  {
    name: 'create_order',
    description: 'Purchase one product with its full configuration through the canonical checkout. Requires billing:write and instances:write. Use the current legalAcceptance from get_catalog with accepted:true only after authorization. A confirmed funded order may charge immediately; otherwise returns a hosted checkoutUrl for payment. Reuse the same idempotency_key and order on retries; only confirm may change from false to true. Poll get_order using orderId.',
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    inputSchema: {
      type: 'object', required: ['order', 'idempotency_key'],
      properties: {
        idempotency_key: { type: 'string', minLength: 8, maxLength: 200 },
        order: {
          type: 'object', required: ['item', 'legalAcceptance'],
          properties: {
            item: { type: 'object', required: ['productSlug'], properties: { productSlug: { type: 'string' }, billingInterval: { type: 'string', enum: ['month', 'year', 'onetime'] }, quantity: { type: 'integer', minimum: 1 }, configuration: { type: 'object' } } },
            legalAcceptance: { type: 'object', description: 'Current terms/privacy version and hashes with accepted:true after customer authorization.' },
            organizationId: { type: 'string' }, confirm: { type: 'boolean' }, useCredits: { type: 'boolean' }, promoCode: { type: 'string' },
            openclawCredential: { type: 'object', description: 'OpenClaw-specific credential required by the selected product configuration.' },
          },
        },
      },
    },
  },
  { name: 'get_order', description: 'Read payment/provisioning status and delivered instance IDs; requires billing:read. Poll every 5 seconds until delivery or a terminal error.', annotations: { readOnlyHint: true }, inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  { name: 'get_instance_access', description: 'Get published SSH host/port/login, host-key pin, RDP endpoint and app URL. Optional credential reveal requires instances:exec and is audited; default requires instances:read and does not reveal passwords.', annotations: { readOnlyHint: true }, inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, include_credentials: { type: 'boolean', default: false } } } },
  { name: 'exec_instance', description: 'Execute a command inside the customer guest/container. Requires instances:exec. Can install/configure software and change files. Array arguments preserve quoting; strings use the Linux shell or Windows PowerShell. Returns stdout, stderr and exitCode, or a pending game receipt. Poll get_game_operation with operation_id; never resubmit an uncertain command automatically.', annotations: { readOnlyHint: false, destructiveHint: true }, inputSchema: { type: 'object', required: ['id', 'command'], properties: { id: { type: 'string' }, command: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 64 }] }, timeout_ms: { type: 'integer', minimum: 1000, maximum: 60000 } } } },
  { name: 'read_instance_file', description: 'Read a UTF-8 guest file; requires instances:files:read.', annotations: { readOnlyHint: true }, inputSchema: { type: 'object', required: ['id', 'path'], properties: { id: { type: 'string' }, path: { type: 'string' } } } },
  { name: 'write_instance_file', description: 'Write/replace a UTF-8 guest file; requires instances:files:write.', annotations: { readOnlyHint: false, destructiveHint: true }, inputSchema: { type: 'object', required: ['id', 'path', 'content'], properties: { id: { type: 'string' }, path: { type: 'string' }, content: { type: 'string' } } } },
  {
    name: 'list_instances',
    description: 'List all virtual machines/instances owned by the authenticated user. Returns name, status, IP, OS, specs, and region for each instance.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_instance',
    description: 'Get detailed information about a specific instance including specs, IP addresses, tags, OS, and current status.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The instance ID (starts with "cl...")',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'start_instance',
    description: 'Start (power on) a stopped virtual machine.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The instance ID to start',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'stop_instance',
    description: 'Stop (graceful ACPI shutdown) a running virtual machine.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The instance ID to stop',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'reboot_instance',
    description: 'Reboot (graceful restart) a running virtual machine.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The instance ID to reboot',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'reset_instance',
    description: 'Restart a virtual machine via the durable power control API (alias of reboot_instance).',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The instance ID to hard reset',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'rename_instance',
    description: 'Update the display name of an instance.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The instance ID',
        },
        name: {
          type: 'string',
          description: 'New display name (1-100 characters)',
        },
      },
      required: ['id', 'name'],
    },
  },
  {
    name: 'set_hostname',
    description: 'Set the hostname of an instance. Must be RFC 1123 compliant (letters, numbers, hyphens, dots).',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The instance ID',
        },
        hostname: {
          type: 'string',
          description: 'New hostname (max 64 chars, RFC 1123 format)',
        },
      },
      required: ['id', 'hostname'],
    },
  },
  {
    name: 'tag_instance',
    description: 'Set tags on an instance. Replaces all existing tags.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The instance ID',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of tag strings (max 20 tags)',
        },
      },
      required: ['id', 'tags'],
    },
  },
  {
    name: 'list_ssh_keys',
    description: 'List all SSH keys on the account.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'add_ssh_key',
    description: 'Add a new SSH public key to the account.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Friendly name for the key (e.g. "Work Laptop")',
        },
        public_key: {
          type: 'string',
          description: 'The SSH public key (e.g. "ssh-ed25519 AAAA... user@host")',
        },
      },
      required: ['name', 'public_key'],
    },
  },
  {
    name: 'delete_ssh_key',
    description: 'Delete an SSH key from the account.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The SSH key ID to delete',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_snapshots',
    description: 'List snapshots for an instance (point-in-time VM state).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The instance ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_snapshot',
    description: 'Create a new snapshot of a running or stopped instance.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The instance ID' },
        name: { type: 'string', description: 'Optional snapshot name' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_checkpoints',
    description: 'List saved network configuration checkpoints for the Virtual Datacenter environment.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Optional environment or instance identifier' },
      },
      required: [],
    },
  },
  {
    name: 'create_checkpoint',
    description: 'Create a named network configuration checkpoint for fast rollback.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Optional environment or instance identifier' },
        name: { type: 'string', description: 'Optional checkpoint label' },
        description: { type: 'string', description: 'Optional checkpoint notes' },
      },
      required: [],
    },
  },
  {
    name: 'restore_checkpoint',
    description: 'Record a network checkpoint restore by checkpoint id or name.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Optional environment or instance identifier' },
        name: { type: 'string', description: 'Checkpoint id or name to restore' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_account',
    description: 'Get account information including email, name, plan, and instance count.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_resource_manager',
    description: 'Inspect SAU Resource Manager: portal & CLI settings, Resource Groups, Tags, Locks, RBAC Role Assignments, Diagnostic Settings, Quotas, Activity Log, or export ARM_JSON / TERRAFORM_HCL.',
    inputSchema: {
      type: 'object',
      properties: {
        section: {
          type: 'string',
          enum: ['overview', 'settings', 'groups', 'tags', 'locks', 'roles', 'diagnostics', 'activity', 'quotas', 'export'],
        },
        resourceGroup: { type: 'string' },
        tagKey: { type: 'string' },
        tagValue: { type: 'string' },
        scope: { type: 'string' },
        format: { type: 'string', enum: ['ARM_JSON', 'TERRAFORM_HCL'] },
      },
      required: [],
    },
  },
  {
    name: 'manage_resource_manager',
    description: 'Configure Resource Manager & Portal Settings: update-portal-settings, upsert-resource-group, delete-resource-group, upsert-tags, delete-tags, create-lock, delete-lock, create-role-assignment, delete-role-assignment, upsert-diagnostic-setting, delete-diagnostic-setting, or export-template.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string' },
        payload: { type: 'object' },
      },
      required: ['action'],
    },
  },
  {
    name: 'list_cloud_saas_services',
    description: 'Browse the 112-service SAU Cloud Platform & Managed SaaS catalog and active subscriptions.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        category: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'manage_cloud_saas_subscription',
    description: 'Activate (subscribe) or cancel a Cloud or Commercial SaaS subscription.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['subscribe', 'cancel'] },
        serviceId: { type: 'string' },
        tier: { type: 'string', enum: ['STARTER', 'PRO', 'ENTERPRISE'] },
        customDomainOrName: { type: 'string' },
        subscriptionId: { type: 'string' },
      },
      required: ['action'],
    },
  },
  {
    name: 'get_cosmos_databases',
    description: 'List SAU Multi-Model Cloud Database instances and optionally query document or vector items.',
    inputSchema: {
      type: 'object',
      properties: {
        databaseId: { type: 'string' },
        collectionName: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'manage_cosmos_database',
    description: 'Operate SAU Multi-Model Cloud Database: create-db, rotate-keys, delete-db, upsert-item, query-items, delete-item.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string' },
        payload: { type: 'object' },
      },
      required: ['action'],
    },
  },
  {
    name: 'get_key_vault_secrets',
    description: 'List Key Vault secret metadata or retrieve a specific secret value.',
    inputSchema: {
      type: 'object',
      properties: {
        vaultName: { type: 'string' },
        secretName: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'set_key_vault_secret',
    description: 'Create or version-update an encrypted secret in SAU Key Vault.',
    inputSchema: {
      type: 'object',
      properties: {
        vaultName: { type: 'string' },
        name: { type: 'string' },
        value: { type: 'string' },
        contentType: { type: 'string' },
      },
      required: ['name', 'value'],
    },
  },
  {
    name: 'get_sentinel_workspace',
    description: 'Inspect SAU Cloud SIEM workspace, incidents, SOAR playbooks, and threat-hunting events.',
    inputSchema: {
      type: 'object',
      properties: {
        kql: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'manage_sentinel_workspace',
    description: 'Run SAU Cloud SIEM & SOAR actions: run-kql, triage-ai, update-incident, create-playbook, rotate-key.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string' },
        payload: { type: 'object' },
      },
      required: ['action'],
    },
  },
  {
    name: 'inspect_cloud_service_plane',
    description: 'Read state across any SAU Cloud Service plane: blob-storage, container-registry, cloud-dns, recovery-vault, bastion, defender-purview, entra-suite, serverless-compute, iot-chaos, app-config, service-bus, workflows, governance, or apim.',
    inputSchema: {
      type: 'object',
      properties: {
        plane: { type: 'string' },
        query: { type: 'object' },
      },
      required: ['plane'],
    },
  },
  {
    name: 'operate_cloud_service_plane',
    description: 'Execute a control-plane action on any SAU Cloud Service plane: blob-storage, container-registry, cloud-dns, recovery-vault, bastion, defender-purview, entra-suite, serverless-compute, iot-chaos, app-config, service-bus, workflows, governance, or apim.',
    inputSchema: {
      type: 'object',
      properties: {
        plane: { type: 'string' },
        body: { type: 'object' },
      },
      required: ['plane', 'body'],
    },
  },
  {
    name: 'list_updates',
    description: 'Inspect current software, OS, catalog product, Cloud SaaS, Cloud Storage, BYOC connector, BYOCloud, and CLI/MCP versions alongside pending updates and release changelogs.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        section: { type: 'string', enum: ['all', 'policy'] },
      },
      required: [],
    },
  },
  {
    name: 'get_update_policy',
    description: 'Read customer auto-update policy defaults and per-resource overrides (platform auto-update ON by default; app/product/service auto-update OFF by default).',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'set_update_policy',
    description: 'Configure customer auto-update policy toggles (platformAutoUpdate, appProductAutoUpdate, autoRollbackOnFailure, notifyOnNewReleases, maintenanceWindowUtc, resourceOverrides).',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        platformAutoUpdate: { type: 'boolean' },
        appProductAutoUpdate: { type: 'boolean' },
        autoRollbackOnFailure: { type: 'boolean' },
        notifyOnNewReleases: { type: 'boolean' },
        maintenanceWindowUtc: { type: ['string', 'null'] },
        resourceOverrides: { type: 'object' },
      },
      required: [],
    },
  },
  {
    name: 'apply_update',
    description: 'Apply the latest verified release update for an owned server, Instant App, server app, hybrid host, cloud connector, or service with automatic checkpointing.',
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        targetId: { type: 'string' },
        targetDomain: { type: 'string' },
        releaseId: { type: 'string' },
      },
      required: ['targetId'],
    },
  },
  {
    name: 'rollback_update',
    description: 'Roll back and recover an update job using its pre-update checkpoint snapshot.',
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['jobId'],
    },
  },
  {
    name: 'list_tenant_environments',
    description: 'List customer environments with isolated Entra Tenant GUIDs, compliance %, Sentinel SIEM, Edge Gateways, Alerting, Plugins, and dedicated MCP endpoints.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: { env: { type: 'string' } },
      required: [],
    },
  },
  {
    name: 'inspect_tenant_environment_domain',
    description: 'Inspect a specific domain of a customer environment: entra, sentinel, edge, compliance, monitoring, or plugins-mcp.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string', enum: ['entra', 'sentinel', 'edge', 'compliance', 'monitoring', 'plugins-mcp'] },
        envId: { type: 'string' },
      },
      required: ['domain'],
    },
  },
  {
    name: 'operate_tenant_environment_domain',
    description: 'Execute a governed action inside a customer environment domain (entra, sentinel, edge, compliance, monitoring, or plugins-mcp).',
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string', enum: ['entra', 'sentinel', 'edge', 'compliance', 'monitoring', 'plugins-mcp'] },
        action: { type: 'string' },
        envId: { type: 'string' },
        payload: { type: 'object' },
      },
      required: ['domain', 'action'],
    },
  },
];
