# Upgrading to v12

v12 preserves supported v11 accounts, campaigns, settings, local images and schema version 2. Back up and verify local data before any deployment. No re-registration or data conversion is required. Keep the previous runtime/image and its matching backup for recovery.

## Existing Debian 13 LXC

The v11 root-owned build helper deliberately selects only stable v11 tags. Therefore the old GUI Update button cannot discover v12 by itself. The unprivileged application cannot replace root executables. A host administrator must install the v12 root helpers once; this preserves the separation between application data and executable deployment authority.

Run as root in the existing LXC after any current update finishes:

```sh
set -euo pipefail
umask 077
DMCT_V12_SOURCE=$(mktemp -d /root/dmct-v12-upgrade.XXXXXXXX)
git clone --depth 1 --branch v12.0.0 \
  https://github.com/CoxkeLamagra/DM-Command-Table.git "$DMCT_V12_SOURCE/source"
git -C "$DMCT_V12_SOURCE/source" rev-parse HEAD
bash "$DMCT_V12_SOURCE/source/deploy/debian-13/install-gui-updater"
systemctl cat dm-command-table-updater.service
```

This installs the trusted v12 root broker/build/verifier helpers and restarts the independent updater service. It does not rebuild the application, initialize storage or print another install token. Keep the printed source revision for the deployment record. Existing custom systemd drop-ins remain in effect: if they pin a v11 target or `staged`, review them and select `latest` or the intended v12 tag before continuing. Never run the fresh application installer over this existing installation.

Open Administration → Update Application and confirm Update application. The old v11 UI may still label `latest` as a v11 source until it has upgraded; the updated root helper resolves it to a stable v12 tag and logs the exact source commit. Preparation runs frozen dependency/audit/format/lint/type/unit/build/browser checks before stopping the application. Root verifies the package, backs up stopped storage, switches releases and checks the expected health version. Preparation failures leave the old application running; deployment failures restore the prior runtime and matching backup.

After completion verify `/api/health` reports `12.0.0`, sign in, and check campaigns, images, Combat and prepared encounter ordering. Later v12 GUI updates require no manual build. The new selector accepts stable v12 tags and excludes prereleases and v13 by default. Explicit host-approved tags/SHAs and staged offline updates remain supported.

The one-time helper installation needs access to the fixed GitHub repository and signed prerequisite/package sources. For a strictly offline host, use the existing root-configured staged-runtime procedure in the [LXC guide](debian-13-lxc.md) with a complete approved v12 package. The supported runtime manifest/database baseline is unchanged, so this path does not need Git tag discovery. Installing automatic source-update helpers runs prerequisite package checks and needs reachable package sources (or a prepared local package mirror); postpone that transition until those sources are available. Runtime operation itself remains offline.

## Fresh Debian installation

Use the v12 [bare Debian 13 LXC instructions](debian-13-lxc.md). The installer pins v12.0.0, includes all prerequisites/helpers and prints the first-admin token only after successful verification. It rejects existing/partial populated storage except the documented safe empty-install resume path.

## Docker

Use the [Docker guide](docker.md): prepare a trusted v12 image, stop the old application, back up/verify data, switch images using the same local volume and verify the expected health version and workflows. Debian root helpers are not used by this container. Retain the previous image and matching backup.
