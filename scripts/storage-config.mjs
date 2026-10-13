import path from "node:path";

/**
 * One storage contract for the server and packaged operational commands.
 * @param {Record<string, string | undefined>} environment
 * @param {string} root
 */
export function storagePaths(environment = process.env, root = process.cwd()) {
  const database = path.resolve(
    /* turbopackIgnore: true */ root,
    /* turbopackIgnore: true */ environment.DM_COMMAND_TABLE_DB_PATH ||
      "data/dm-command-table.sqlite",
  );
  return {
    database,
    uploads: path.resolve(
      /* turbopackIgnore: true */ root,
      /* turbopackIgnore: true */ environment.DM_COMMAND_TABLE_UPLOAD_PATH ||
        path.join(path.dirname(database), "uploads"),
    ),
    backups: path.resolve(
      /* turbopackIgnore: true */ root,
      /* turbopackIgnore: true */ environment.DM_COMMAND_TABLE_BACKUP_PATH ||
        path.join(path.dirname(database), "backups"),
    ),
  };
}
