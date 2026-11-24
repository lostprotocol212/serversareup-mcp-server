/**
 * Tool Call Handlers
 *
 * Maps MCP tool calls to SAU API client methods.
 */

import type { SAUClient } from './client.js';

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

function success(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function error(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  };
}

export async function handleToolCall(
  client: SAUClient,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case 'delete_instance':
        if (typeof args.id !== 'string' || !args.id || (args.permanent !== undefined && typeof args.permanent !== 'boolean')
          || (args.idempotency_key !== undefined && typeof args.idempotency_key !== 'string')) {
          return error('id is required; permanent must be a boolean and idempotency_key must be a string.');
        }
        return success(await client.deleteInstance(args.id, args.permanent === true, args.idempotency_key as string | undefined));
      case 'quote_backup_policy':
        if (typeof args.product_slug !== 'string' || !args.product_slug || typeof args.lineage_id !== 'string' || !args.lineage_id) {
          return error('Missing required parameters: product_slug, lineage_id');
        }
        return success(await client.quoteBackupPolicy(args.product_slug, args.lineage_id));
      case 'list_backup_sources':
        return success(await client.listBackupSources());
      case 'get_catalog':
        return success(await client.getCatalog(typeof args.type === 'string' ? args.type : undefined));
      case 'create_order': {
        if (typeof args.idempotency_key !== 'string' || !args.order || typeof args.order !== 'object' || Array.isArray(args.order)) {
          return error('Missing required parameters: idempotency_key, order');
        }
        return success(await client.createOrder(args.order as Record<string, unknown>, args.idempotency_key));
      }
      case 'get_order':
        if (typeof args.id !== 'string' || !args.id) return error('Missing required parameter: id');
        return success(await client.getOrder(args.id));
      case 'get_instance_access':
        if (typeof args.id !== 'string' || !args.id) return error('Missing required parameter: id');
        return success(await client.getInstanceAccess(args.id, args.include_credentials === true));
      case 'exec_instance': {
        if (typeof args.id !== 'string' || !args.id || !(typeof args.command === 'string' || Array.isArray(args.command))) {
          return error('Missing required parameters: id, command');
        }
        const result = await client.execInstance(args.id, args.command as string | string[], typeof args.timeout_ms === 'number' ? args.timeout_ms : undefined);
        return { ...success(result), ...(result.pending || result.success ? {} : { isError: true }) };
      }
      case 'get_game_operation': {
        if (typeof args.id !== 'string' || !args.id || typeof args.operation_id !== 'string' || !args.operation_id) return error('Missing required parameters: id, operation_id');
        const result = await client.getGameOperation(args.id, args.operation_id);
        return { ...success(result), ...(result.success === false ? { isError: true } : {}) };
      }
      case 'read_instance_file':
        if (typeof args.id !== 'string' || typeof args.path !== 'string') return error('Missing required parameters: id, path');
        return success(await client.readInstanceFile(args.id, args.path));
      case 'write_instance_file':
        if (typeof args.id !== 'string' || typeof args.path !== 'string' || typeof args.content !== 'string') return error('Missing required parameters: id, path, content');
        return success(await client.writeInstanceFile(args.id, args.path, args.content));
      case 'list_instances': {
        const instances = await client.listInstances();
        return success({
          count: instances.length,
          instances: instances.map((i) => ({
            id: i.id,
            name: i.name,
            status: i.status,
            ip: i.ip,
            os: i.os,
            product: i.product?.name,
            region: i.region,
          })),
        });
      }

      case 'get_instance': {
        const id = args.id as string;
        if (!id) return error('Missing required parameter: id');
        const instance = await client.getInstance(id);
        return success(instance);
      }

      case 'start_instance': {
        const id = args.id as string;
        if (!id) return error('Missing required parameter: id');
        const result = await client.powerAction(id, 'start');
        return success(result);
      }

      case 'stop_instance': {
        const id = args.id as string;
        if (!id) return error('Missing required parameter: id');
        const result = await client.powerAction(id, 'stop');
        return success(result);
      }

      case 'reboot_instance': {
        const id = args.id as string;
        if (!id) return error('Missing required parameter: id');
        const result = await client.powerAction(id, 'reboot');
        return success(result);
      }

      case 'reset_instance': {
        const id = args.id as string;
        if (!id) return error('Missing required parameter: id');
        const result = await client.powerAction(id, 'reset');
        return success(result);
      }

      case 'rename_instance': {
        const id = args.id as string;
        const name = args.name as string;
        if (!id || !name) return error('Missing required parameters: id, name');
        const instance = await client.updateInstance(id, { name });
        return success({ success: true, name: instance.name });
      }

      case 'set_hostname': {
        const id = args.id as string;
        const hostname = args.hostname as string;
        if (!id || !hostname) return error('Missing required parameters: id, hostname');
        const instance = await client.updateInstance(id, { hostname });
        return success({ success: true, hostname: instance.hostname });
      }

      case 'tag_instance': {
        const id = args.id as string;
        const tags = args.tags as string[];
        if (!id || !tags) return error('Missing required parameters: id, tags');
        const instance = await client.updateInstance(id, { tags });
        return success({ success: true, tags: instance.tags });
      }

      case 'list_ssh_keys': {
        const keys = await client.listSSHKeys();
        return success({ count: keys.length, keys });
      }

      case 'add_ssh_key': {
        const name = args.name as string;
        const publicKey = args.public_key as string;
        if (!name || !publicKey) return error('Missing required parameters: name, public_key');
        const key = await client.addSSHKey(name, publicKey);
        return success({ success: true, key });
      }

      case 'delete_ssh_key': {
        const id = args.id as string;
        if (!id) return error('Missing required parameter: id');
        await client.deleteSSHKey(id);
        return success({ success: true, message: `SSH key ${id} deleted` });
      }

      case 'list_snapshots': {
        const id = args.id as string;
        if (!id) return error('Missing required parameter: id');
        const snapshots = await client.listSnapshots(id);
        return success({ count: snapshots.length, snapshots });
      }

      case 'create_snapshot': {
        const id = args.id as string;
        const name = args.name as string | undefined;
        if (!id) return error('Missing required parameter: id');
        const result = await client.createSnapshot(id, name);
        return success(result);
      }

      case 'list_checkpoints': {
        const id = args.id as string | undefined;
        const checkpoints = await client.listCheckpoints(id);
        return success({ count: checkpoints.length, checkpoints });
      }

      case 'create_checkpoint': {
        const id = args.id as string | undefined;
        const name = args.name as string | undefined;
        const description = args.description as string | undefined;
        const result = await client.createCheckpoint(id, name, description);
        return success(result);
      }

      case 'restore_checkpoint': {
        const id = args.id as string | undefined;
        const name = args.name as string;
        if (!name) return error('Missing required parameter: name');
        const result = await client.restoreCheckpoint(id, name);
        return success(result);
      }

      case 'get_account': {
        const account = await client.getAccount();
        return success(account);
      }

      case 'get_resource_manager': {
        const params: Record<string, string | number | undefined> = {};
        for (const k of ['section', 'resourceGroup', 'tagKey', 'tagValue', 'scope', 'format']) {
          if (typeof args[k] === 'string' && !(k === 'section' && args[k] === 'overview')) {
            params[k] = args[k] as string;
          }
        }
        return success(await client.getResourceManager(params));
      }

      case 'manage_resource_manager': {
        const action = args.action as string;
        if (!action) return error('Missing required parameter: action');
        const payload = (args.payload && typeof args.payload === 'object' ? args.payload : {}) as Record<string, unknown>;
        return success(await client.manageResourceManager(action, payload));
      }

      case 'list_cloud_saas_services': {
        return success(await client.listCloudSaaSServices(args.query as string | undefined, args.category as string | undefined));
      }

      case 'manage_cloud_saas_subscription': {
        return success(await client.manageCloudSaaSSubscription(args));
      }

      case 'get_cosmos_databases': {
        return success(await client.getCosmosDatabases(args.databaseId as string | undefined, args.collectionName as string | undefined));
      }

      case 'manage_cosmos_database': {
        const action = args.action as string;
        if (!action) return error('Missing required parameter: action');
        const payload = (args.payload && typeof args.payload === 'object' ? args.payload : {}) as Record<string, unknown>;
        return success(await client.manageCosmosDatabase(action, payload));
      }

      case 'get_key_vault_secrets': {
        return success(await client.getKeyVaultSecrets(args.vaultName as string | undefined, args.secretName as string | undefined));
      }

      case 'set_key_vault_secret': {
        const name = args.name as string;
        const value = args.value as string;
        if (!name || value === undefined) return error('Missing required parameters: name, value');
        return success(
          await client.setKeyVaultSecret({
            vaultName: args.vaultName as string | undefined,
            name,
            value: String(value),
            contentType: args.contentType as string | undefined,
          }),
        );
      }

      case 'get_sentinel_workspace': {
        return success(await client.getSentinelWorkspace(args.kql as string | undefined));
      }

      case 'manage_sentinel_workspace': {
        const action = args.action as string;
        if (!action) return error('Missing required parameter: action');
        const payload = (args.payload && typeof args.payload === 'object' ? args.payload : {}) as Record<string, unknown>;
        return success(await client.manageSentinelWorkspace(action, payload));
      }

      case 'inspect_cloud_service_plane': {
        const plane = args.plane as string;
        if (!plane) return error('Missing required parameter: plane');
        const query = (args.query && typeof args.query === 'object' ? args.query : {}) as Record<string, unknown>;
        return success(await client.inspectCloudServicePlane(plane, query));
      }

      case 'operate_cloud_service_plane': {
        const plane = args.plane as string;
        if (!plane) return error('Missing required parameter: plane');
        const body = (args.body && typeof args.body === 'object' ? args.body : {}) as Record<string, unknown>;
        return success(await client.operateCloudServicePlane(plane, body));
      }

      case 'list_updates': {
        const section = typeof args.section === 'string' ? args.section : undefined;
        return success(await client.listUpdates(section));
      }

      case 'get_update_policy': {
        return success(await client.getUpdatePolicy());
      }

      case 'set_update_policy': {
        return success(
          await client.setUpdatePolicy({
            platformAutoUpdate: typeof args.platformAutoUpdate === 'boolean' ? args.platformAutoUpdate : undefined,
            appProductAutoUpdate: typeof args.appProductAutoUpdate === 'boolean' ? args.appProductAutoUpdate : undefined,
            autoRollbackOnFailure: typeof args.autoRollbackOnFailure === 'boolean' ? args.autoRollbackOnFailure : undefined,
            notifyOnNewReleases: typeof args.notifyOnNewReleases === 'boolean' ? args.notifyOnNewReleases : undefined,
            maintenanceWindowUtc:
              args.maintenanceWindowUtc === null || typeof args.maintenanceWindowUtc === 'string'
                ? args.maintenanceWindowUtc
                : undefined,
            resourceOverrides:
              args.resourceOverrides && typeof args.resourceOverrides === 'object' && !Array.isArray(args.resourceOverrides)
                ? (args.resourceOverrides as Record<string, boolean>)
                : undefined,
          }),
        );
      }

      case 'apply_update': {
        const targetId = args.targetId as string;
        if (!targetId) return error('Missing required parameter: targetId');
        return success(
          await client.applyUpdate({
            targetId,
            targetDomain: typeof args.targetDomain === 'string' ? args.targetDomain : undefined,
            releaseId: typeof args.releaseId === 'string' ? args.releaseId : undefined,
          }),
        );
      }

      case 'rollback_update': {
        const jobId = args.jobId as string;
        if (!jobId) return error('Missing required parameter: jobId');
        return success(await client.rollbackUpdate(jobId, typeof args.reason === 'string' ? args.reason : undefined));
      }

      case 'list_tenant_environments': {
        const env = typeof args.env === 'string' ? args.env : undefined;
        return success(await client.listTenantEnvironments(env));
      }

      case 'inspect_tenant_environment_domain': {
        const domain = String(args.domain || '') as 'entra' | 'sentinel' | 'edge' | 'compliance' | 'monitoring' | 'plugins-mcp';
        if (!domain) return error('Missing required parameter: domain');
        return success(await client.inspectTenantEnvironmentDomain(domain, typeof args.envId === 'string' ? args.envId : undefined));
      }

      case 'operate_tenant_environment_domain': {
        const domain = String(args.domain || '') as 'entra' | 'sentinel' | 'edge' | 'compliance' | 'monitoring' | 'plugins-mcp';
        const action = String(args.action || '');
        if (!domain || !action) return error('Missing required parameters: domain, action');
        const payload = (args.payload && typeof args.payload === 'object' ? args.payload : {}) as Record<string, unknown>;
        return success(await client.operateTenantEnvironmentDomain(domain, action, payload, typeof args.envId === 'string' ? args.envId : undefined));
      }

      default:
        return error(`Unknown tool: ${toolName}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return error(message);
  }
}
