/**
 * SAU API Client
 *
 * Typed HTTP client for the ServersAreUp v1 API.
 */

export interface Instance {
  id: string;
  name: string;
  status: string;
  ip: string | null;
  privateIp: string | null;
  hostname: string | null;
  os: string | null;
  vmId: string | null;
  tags: string[];
  product: {
    name: string;
    slug: string;
    specs: Record<string, unknown>;
    priceCents: number;
  } | null;
  region: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SSHKey {
  id: string;
  name: string;
  fingerprint: string;
  createdAt: string;
}

export interface Account {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  instanceCount: number;
  role: string;
}

type RawListInstance = {
  id: string;
  name: string;
  status: string;
  publicIp?: string | null;
  hostname?: string | null;
  selectedOs?: string | null;
  createdAt: string;
  product?: { name: string; type?: string } | null;
};

function normalizeListInstance(raw: RawListInstance): Instance {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status,
    ip: raw.publicIp ?? null,
    privateIp: null,
    hostname: raw.hostname ?? null,
    os: raw.selectedOs ?? null,
    vmId: null,
    tags: [],
    product: raw.product
      ? {
          name: raw.product.name,
          slug: '',
          specs: {},
          priceCents: 0,
        }
      : null,
    region: null,
    createdAt: raw.createdAt,
    updatedAt: raw.createdAt,
  };
}

export type GuestCommandResult = {
  success: boolean; exitCode: number; stdout: string; stderr: string; pending?: false;
} | { pending: true; operationId: string; status: string; pollUrl: string };

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const MAX_PAGINATION_PAGES = 100;

function validateSauApiBaseUrl(rawBaseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawBaseUrl);
  } catch {
    throw new Error('SAU_API_BASE must be a valid URL (e.g. https://serversareup.com).');
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('SAU_API_BASE must not contain URL credentials, query parameters, or fragments.');
  }
  const isHttps = parsed.protocol === 'https:';
  const isLoopbackHttp = parsed.protocol === 'http:' && LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase());
  if (!isHttps && !isLoopbackHttp) {
    throw new Error('SAU_API_BASE must use https:// (http:// is allowed only on loopback addresses).');
  }
  return parsed.toString().replace(/\/$/, '');
}

export class SAUClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = validateSauApiBaseUrl(baseUrl);
    this.token = token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const response = await fetch(url, {
      ...options,
      redirect: 'error',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'serversareup-mcp/0.3.0',
        ...options.headers,
      },
      signal: options.signal ?? AbortSignal.timeout(75_000),
    });

    if (!response.ok) {
      const body = await response.text();
      let message: string;
      try {
        const json = JSON.parse(body);
        message = `${json.code ? `${json.code}: ` : ''}${json.error || body}`;
      } catch {
        message = body;
      }
      const retryAfter = response.headers.get('retry-after');
      throw new Error(`SAU API error ${response.status}: ${message}${retryAfter ? ` (retry after ${retryAfter}s)` : ''}`);
    }

    const body = await response.text();
    return (body ? JSON.parse(body) : {}) as T;
  }

  async listInstances(): Promise<Instance[]> {
    const instances: Instance[] = [];
    for (let page = 0; page < MAX_PAGINATION_PAGES; page++) {
      const data = await this.request<{ instances?: RawListInstance[]; total?: number }>(`/instances?limit=200&offset=${instances.length}`);
      const rows = Array.isArray(data.instances) ? data.instances : [];
      instances.push(...rows.map(normalizeListInstance));
      if (!rows.length || instances.length >= (data.total ?? instances.length)) return instances;
    }
    return instances;
  }

  async getCatalog(type?: string): Promise<unknown> {
    return this.request(`/catalog${type ? `?type=${encodeURIComponent(type)}` : ''}`);
  }

  async listBackupSources(): Promise<unknown[]> {
    const sources: unknown[] = [];
    for (let page = 0, offset = 0; page < MAX_PAGINATION_PAGES; page++, offset += 100) {
      const pageData = await this.request<{ sources: unknown[]; total: number }>(`/backups/sources?limit=100&offset=${offset}`);
      if (!Array.isArray(pageData.sources) || !Number.isSafeInteger(pageData.total) || pageData.total < 0) throw new Error('Invalid backup source response');
      sources.push(...pageData.sources);
      if (!pageData.sources.length || offset + 100 >= pageData.total) return sources;
    }
    return sources;
  }

  async quoteBackupPolicy(productSlug: string, lineageId: string): Promise<unknown> {
    return this.request(`/backups/quote?productSlug=${encodeURIComponent(productSlug)}&lineageId=${encodeURIComponent(lineageId)}`);
  }

  async deleteInstance(id: string, permanent = false, idempotencyKey?: string): Promise<unknown> {
    return this.request(`/instances/${encodeURIComponent(id)}${permanent ? '?permanent=true' : ''}`, {
      method: 'DELETE', ...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}),
    });
  }

  async createOrder(order: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    return this.request('/orders', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(order) });
  }

  async getOrder(id: string): Promise<unknown> { return this.request(`/orders/${encodeURIComponent(id)}`); }

  async getInstanceAccess(id: string, credentials = false): Promise<unknown> {
    return this.request(`/instances/${encodeURIComponent(id)}/access${credentials ? '?credentials=true' : ''}`);
  }

  async execInstance(id: string, command: string | string[], timeoutMs?: number): Promise<GuestCommandResult> {
    return this.request(`/instances/${encodeURIComponent(id)}/exec`, { method: 'POST', body: JSON.stringify({ command, timeoutMs }) });
  }

  async readInstanceFile(id: string, path: string): Promise<unknown> {
    return this.request(`/instances/${encodeURIComponent(id)}/files?path=${encodeURIComponent(path)}`);
  }

  async getGameOperation(id: string, operationId: string): Promise<Record<string, unknown>> {
    return this.request('/instances/' + encodeURIComponent(id) + '/game-server/control?operationId=' + encodeURIComponent(operationId));
  }

  async writeInstanceFile(id: string, path: string, content: string): Promise<unknown> {
    return this.request(`/instances/${encodeURIComponent(id)}/files`, { method: 'PUT', body: JSON.stringify({ path, content }) });
  }

  async getInstance(id: string): Promise<Instance> {
    return this.request<Instance>(`/instances/${encodeURIComponent(id)}`);
  }

  async updateInstance(id: string, updates: { hostname?: string; name?: string; tags?: string[] }): Promise<Instance> {
    return this.request<Instance>(`/instances/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async powerAction(id: string, action: 'start' | 'stop' | 'reboot' | 'reset'): Promise<Record<string, unknown>> {
    const apiAction = action === 'reboot' || action === 'reset' ? 'restart' : action;
    const result = await this.request<{ success: boolean; action?: string; error?: string }>(
      `/instances/${encodeURIComponent(id)}/power`,
      {
        method: 'POST',
        body: JSON.stringify({ action: apiAction }),
      },
    );
    return {
      ...result,
      message: result.error ?? `Power action ${apiAction} accepted`,
    };
  }

  async listSSHKeys(): Promise<SSHKey[]> {
    const data = await this.request<{ sshKeys?: SSHKey[] }>('/ssh-keys');
    return Array.isArray(data.sshKeys) ? data.sshKeys : [];
  }

  async addSSHKey(name: string, publicKey: string): Promise<SSHKey> {
    const data = await this.request<{ sshKey?: SSHKey; key?: SSHKey }>('/ssh-keys', {
      method: 'POST',
      body: JSON.stringify({ name, publicKey }),
    });
    const key = data.sshKey ?? data.key;
    if (!key) {
      throw new Error('SAU API error: ssh-keys POST returned no key');
    }
    return key;
  }

  async deleteSSHKey(id: string): Promise<void> {
    await this.request<void>(`/ssh-keys/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async listSnapshots(instanceId: string): Promise<unknown[]> {
    const data = await this.request<{ snapshots?: unknown[] }>(
      `/instances/${encodeURIComponent(instanceId)}/snapshots`,
    );
    return Array.isArray(data.snapshots) ? data.snapshots : [];
  }

  async createSnapshot(instanceId: string, name?: string): Promise<{ success: boolean; message: string }> {
    const result = await this.request<{
      success?: boolean;
      accepted?: boolean;
      commandId?: string;
      status?: string;
      snapshotName?: string;
      message?: string;
      snapshot?: { name?: string };
      error?: string;
    }>(
      `/instances/${encodeURIComponent(instanceId)}/snapshots`,
      {
        method: 'POST',
        body: JSON.stringify(name ? { name } : {}),
      },
    );
    const snapLabel = result.snapshot?.name ?? result.snapshotName ?? name ?? result.commandId ?? 'queued';
    return {
      success: result.success !== false && !result.error,
      message: result.error ?? result.message ?? `Snapshot ${snapLabel} (${result.status ?? 'created'})`,
    };
  }

  async listCheckpoints(_instanceId?: string): Promise<unknown[]> {
    const data = await this.request<{ checkpoints?: unknown[] }>('/network/checkpoints');
    return Array.isArray(data.checkpoints) ? data.checkpoints : [];
  }

  async createCheckpoint(_instanceId?: string, name?: string, description?: string): Promise<{ success: boolean; message: string; checkpoint?: unknown }> {
    const result = await this.request<{ checkpoint?: unknown; error?: string }>(
      '/network/checkpoints',
      {
        method: 'POST',
        body: JSON.stringify({
          ...(name ? { name } : {}),
          ...(description ? { description } : {}),
        }),
      },
    );
    return {
      success: !result.error,
      message: result.error ?? 'Checkpoint created',
      checkpoint: result.checkpoint,
    };
  }

  async restoreCheckpoint(_instanceId: string | undefined, nameOrId: string): Promise<{ success: boolean; message: string }> {
    const result = await this.request<{ success?: boolean; error?: string; checkpoint?: string }>(
      '/network/checkpoints',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'restore', checkpointId: nameOrId, name: nameOrId }),
      },
    );
    return {
      success: result.success !== false,
      message: result.error ?? `Restored checkpoint ${result.checkpoint ?? nameOrId}`,
    };
  }

  async getResourceManager(params: Record<string, string | number | undefined> = {}): Promise<unknown> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request(`/resource-manager${suffix}`);
  }

  async manageResourceManager(action: string, payload: Record<string, unknown> = {}): Promise<unknown> {
    return this.request('/resource-manager', {
      method: 'POST',
      body: JSON.stringify({ ...payload, action }),
    });
  }

  async listCloudSaaSServices(query?: string, category?: string): Promise<unknown> {
    const qs = new URLSearchParams();
    if (query) qs.set('q', query);
    if (category) qs.set('category', category);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request(`/cloud-services${suffix}`);
  }

  async manageCloudSaaSSubscription(body: Record<string, unknown>): Promise<unknown> {
    return this.request('/cloud-services', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getCosmosDatabases(databaseId?: string, collectionName?: string): Promise<unknown> {
    const qs = new URLSearchParams();
    if (databaseId) qs.set('databaseId', databaseId);
    if (collectionName) qs.set('collectionName', collectionName);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request(`/cosmos${suffix}`);
  }

  async manageCosmosDatabase(action: string, payload: Record<string, unknown> = {}): Promise<unknown> {
    return this.request('/cosmos', {
      method: 'POST',
      body: JSON.stringify({ ...payload, action }),
    });
  }

  async getKeyVaultSecrets(vaultName = 'default-vault', secretName?: string): Promise<unknown> {
    const qs = new URLSearchParams({ vault: vaultName });
    if (secretName) qs.set('name', secretName);
    return this.request(`/vault/secrets?${qs.toString()}`);
  }

  async setKeyVaultSecret(body: { vaultName?: string; name: string; value: string; contentType?: string }): Promise<unknown> {
    return this.request('/vault/secrets', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getSentinelWorkspace(kql?: string): Promise<unknown> {
    const suffix = kql ? `?kql=${encodeURIComponent(kql)}` : '';
    return this.request(`/sentinel${suffix}`);
  }

  async manageSentinelWorkspace(action: string, payload: Record<string, unknown> = {}): Promise<unknown> {
    return this.request('/sentinel', {
      method: 'POST',
      body: JSON.stringify({ ...payload, action }),
    });
  }

  async inspectCloudServicePlane(plane: string, query: Record<string, unknown> = {}): Promise<unknown> {
    const allowed = new Set([
      'blob-storage',
      'container-registry',
      'cloud-dns',
      'recovery-vault',
      'bastion',
      'defender-purview',
      'entra-suite',
      'serverless-compute',
      'iot-chaos',
      'app-config',
      'service-bus',
      'workflows',
      'governance',
      'apim',
    ]);
    if (!allowed.has(plane)) throw new Error(`Unsupported cloud plane: ${plane}`);
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) qs.set(k, String(v));
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request(`/${plane}${suffix}`);
  }

  async operateCloudServicePlane(plane: string, body: Record<string, unknown> = {}): Promise<unknown> {
    const allowed = new Set([
      'blob-storage',
      'container-registry',
      'cloud-dns',
      'recovery-vault',
      'bastion',
      'defender-purview',
      'entra-suite',
      'serverless-compute',
      'iot-chaos',
      'app-config',
      'service-bus',
      'workflows',
      'governance',
      'apim',
    ]);
    if (!allowed.has(plane)) throw new Error(`Unsupported cloud plane: ${plane}`);
    return this.request(`/${plane}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async listUpdates(section?: string): Promise<unknown> {
    const qs = section ? `?section=${encodeURIComponent(section)}` : '';
    return this.request(`/updates${qs}`);
  }

  async getUpdatePolicy(): Promise<unknown> {
    return this.request('/updates?section=policy');
  }

  async setUpdatePolicy(input: {
    platformAutoUpdate?: boolean;
    appProductAutoUpdate?: boolean;
    autoRollbackOnFailure?: boolean;
    notifyOnNewReleases?: boolean;
    maintenanceWindowUtc?: string | null;
    resourceOverrides?: Record<string, boolean>;
  }): Promise<unknown> {
    return this.request('/updates', {
      method: 'POST',
      body: JSON.stringify({ action: 'update-policy', ...input }),
    });
  }

  async applyUpdate(input: { targetId: string; targetDomain?: string; releaseId?: string }): Promise<unknown> {
    return this.request('/updates', {
      method: 'POST',
      body: JSON.stringify({ action: 'apply-update', ...input }),
    });
  }

  async rollbackUpdate(jobId: string, reason?: string): Promise<unknown> {
    return this.request('/updates', {
      method: 'POST',
      body: JSON.stringify({ action: 'rollback', jobId, reason }),
    });
  }

  async listTenantEnvironments(env?: string): Promise<unknown> {
    const query = env ? `?env=${encodeURIComponent(env)}` : '';
    return this.request(`/tenant-environment${query}`);
  }

  async inspectTenantEnvironmentDomain(
    domain: 'entra' | 'sentinel' | 'edge' | 'compliance' | 'monitoring' | 'plugins-mcp',
    envId?: string,
  ): Promise<unknown> {
    const query = envId ? `?envId=${encodeURIComponent(envId)}` : '';
    return this.request(`/tenant-environment/${domain}${query}`);
  }

  async operateTenantEnvironmentDomain(
    domain: 'entra' | 'sentinel' | 'edge' | 'compliance' | 'monitoring' | 'plugins-mcp',
    action: string,
    payload?: Record<string, unknown>,
    envId?: string,
  ): Promise<unknown> {
    return this.request(`/tenant-environment/${domain}`, {
      method: 'POST',
      body: JSON.stringify({ ...(payload ?? {}), action, ...(envId ? { envId } : {}) }),
    });
  }

  async getAccount(): Promise<Account> {
    const data = await this.request<{
      id: string;
      email: string;
      name: string;
      createdAt: string;
      role?: string;
      resources?: { instances?: number };
    }>('/account');
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      createdAt: data.createdAt,
      instanceCount: data.resources?.instances ?? 0,
      role: data.role ?? 'USER',
    };
  }
}
