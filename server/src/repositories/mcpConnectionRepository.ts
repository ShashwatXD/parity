import { sqlite } from '../db/database.js';
import type { ConnectionStatus, McpConnection, McpTransport } from '../models.js';

export const McpConnectionRepository = {
  upsert(row: {
    id: string;
    name: string;
    transport: McpTransport;
    configJson: string;
    status: ConnectionStatus;
    lastError: string | null;
  }) {
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO mcp_connections
          (id, name, transport, config_json, status, last_error, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           last_error = excluded.last_error,
           updated_at = excluded.updated_at`,
      )
      .run(
        row.id,
        row.name,
        row.transport,
        row.configJson,
        row.status,
        row.lastError,
        now,
        now,
      );
  },

  setStatus(id: string, status: ConnectionStatus) {
    sqlite
      .prepare(`UPDATE mcp_connections SET status = ?, updated_at = ? WHERE id = ?`)
      .run(status, Date.now(), id);
  },

  listSaved(): McpConnection[] {
    return sqlite
      .prepare(
        `SELECT id, name, transport, config_json as configJson, status, last_error as lastError,
                created_at as createdAt, updated_at as updatedAt
         FROM mcp_connections ORDER BY updated_at DESC`,
      )
      .all() as McpConnection[];
  },
};
