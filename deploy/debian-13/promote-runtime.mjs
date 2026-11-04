import {
  constants,
  openSync,
  closeSync,
  fstatSync,
  lstatSync,
  opendirSync,
  mkdirSync,
  readlinkSync,
  symlinkSync,
  readSync,
  writeSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Linux descriptor-anchored promotion. Source paths are never dereferenced as
// root: every opened inode must belong to the selected build/staging owner.
export function promoteRuntime(source, destination, sourceOwner) {
  if (!Number.isSafeInteger(sourceOwner) || sourceOwner < 0)
    throw new Error("Invalid source owner.");
  if (process.platform !== "linux")
    throw new Error("Runtime promotion requires Linux /proc descriptors.");
  const noLinks = constants.O_NOFOLLOW | constants.O_NONBLOCK;
  const pathOnly = 0x200000; // Linux O_PATH: inspect without opening a device/FIFO.

  const root = openSync(
    source,
    pathOnly | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  let target;
  let entries = 0,
    bytes = 0;
  function owned(fd, directory) {
    const info = fstatSync(fd);
    if (
      info.uid !== sourceOwner ||
      (directory ? !info.isDirectory() : !info.isFile())
    )
      throw new Error("Untrusted runtime source inode.");
    return info;
  }
  function fdPath(fd, name = "") {
    return `/proc/self/fd/${fd}` + (name ? "/" + name : "");
  }
  function copy(from, to, relative, depth) {
    if (depth > 64) throw new Error("Runtime nesting limit exceeded.");
    owned(from, true);
    const directory = opendirSync(fdPath(from));
    try {
      let entry;
      while ((entry = directory.readSync())) {
        if (++entries > 200000)
          throw new Error("Runtime entry limit exceeded.");
        const name = entry.name,
          src = fdPath(from, name),
          dest = fdPath(to, name);
        const info = lstatSync(src);
        if (info.uid !== sourceOwner)
          throw new Error("Untrusted runtime source owner.");
        if (info.isSymbolicLink()) {
          const link = readlinkSync(src);
          // Relative link targets are resolved from the package root. Lexical
          // traversal above the root must reject even if resolve normalizes it.
          let level = relative ? relative.split("/").length : 0;
          if (path.isAbsolute(link))
            throw new Error("Runtime link escapes package.");
          for (const part of link.split("/")) {
            if (part === "..") {
              if (--level < 0) throw new Error("Runtime link escapes package.");
            } else if (part && part !== ".") level++;
          }
          symlinkSync(link, dest);
        } else {
          if (!info.isDirectory() && !info.isFile())
            throw new Error("Unsupported runtime source entry.");
          const child = openSync(src, pathOnly | constants.O_NOFOLLOW);
          try {
            const opened = owned(child, info.isDirectory());
            if (opened.isDirectory()) {
              mkdirSync(dest, { mode: 0o700 });
              const output = openSync(
                dest,
                constants.O_RDONLY | constants.O_DIRECTORY | noLinks,
              );
              try {
                copy(
                  child,
                  output,
                  relative ? relative + "/" + name : name,
                  depth + 1,
                );
              } finally {
                closeSync(output);
              }
            } else {
              if ((bytes += opened.size) > 2 * 1024 * 1024 * 1024)
                throw new Error("Runtime byte limit exceeded.");
              const input = openSync(
                fdPath(child),
                constants.O_RDONLY | constants.O_NONBLOCK,
              );
              try {
                owned(input, false);
                const output = openSync(
                  dest,
                  constants.O_WRONLY |
                    constants.O_CREAT |
                    constants.O_EXCL |
                    noLinks,
                  opened.mode & 0o111 ? 0o700 : 0o600,
                );
                try {
                  const buffer = Buffer.allocUnsafe(65536);
                  let copied = 0,
                    count;
                  while (
                    (count = readSync(input, buffer, 0, buffer.length, null))
                  ) {
                    if ((copied += count) > opened.size)
                      throw new Error(
                        "Runtime source changed during promotion.",
                      );
                    let offset = 0;
                    while (offset < count)
                      offset += writeSync(
                        output,
                        buffer,
                        offset,
                        count - offset,
                      );
                  }
                  if (copied !== opened.size)
                    throw new Error("Runtime source changed during promotion.");
                } finally {
                  closeSync(output);
                }
              } finally {
                closeSync(input);
              }
            }
          } finally {
            closeSync(child);
          }
        }
      }
    } finally {
      directory.closeSync();
    }
  }
  try {
    owned(root, true);
    target = openSync(
      destination,
      constants.O_RDONLY | constants.O_DIRECTORY | noLinks,
    );
    const info = fstatSync(target);
    if (info.uid !== process.getuid() || info.mode & 0o077)
      throw new Error(
        "Promotion destination must be private and owned by the caller.",
      );
    const directory = opendirSync(fdPath(target));
    try {
      if (directory.readSync())
        throw new Error("Promotion destination must be empty.");
    } finally {
      directory.closeSync();
    }
    copy(root, target, "", 0);
  } finally {
    if (target !== undefined) closeSync(target);
    closeSync(root);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.getuid?.() !== 0)
    throw new Error("Runtime promotion must run as root.");
  promoteRuntime(process.argv[2], process.argv[3], Number(process.argv[4]));
}
