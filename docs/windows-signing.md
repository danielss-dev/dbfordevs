# Windows signing

Release builds for Windows are Authenticode-signed through Azure Artifact Signing
when the repository **variable** `WINDOWS_SIGNING` is `true`. Without it the
Windows installers are built unsigned, as before.

## What gets signed

The `release` workflow's Windows job runs `scripts/windows-signing-client.ps1`,
which fetches the SHA-256-pinned `Microsoft.ArtifactSigning.Client` (SignTool's
dlib), writes the account metadata, and writes a Tauri config that sets
`bundle.windows.signCommand` to `scripts/windows-sign.ps1`. `tauri-action` gets
that config through `--config`, so Tauri signs `dbfordevs.exe`, the `.msi`, and the
NSIS setup and uninstaller. `scripts/windows-sign.ps1` signs with the newest
Windows SDK SignTool and Microsoft's timestamp server, then fails unless Windows
reports the signature `Valid`.

After the build, a verify step checks the MSI, the NSIS setup, and every `.exe`
the MSI installs (unpacked with an administrative install).

## Azure and secrets

- Artifact Signing account `halterio-signing` (resource group
  `rg-halterio-signing`, East US), certificate profile `public-trust`, shared with
  the developer's other apps.
- Service principal `dbfordevs-release-signing`, with only the Artifact Signing
  Certificate Profile Signer role on that account. Its credentials are the
  repository secrets `AZURE_SIGNING_CLIENT_ID`, `AZURE_SIGNING_TENANT_ID` and
  `AZURE_SIGNING_CLIENT_SECRET`, and reach only the `tauri-action` step.
- The client secret was made on 2026-11-11 for two years. Renew it with
  `az ad sp credential reset --id <AZURE_SIGNING_CLIENT_ID> --years 2`, then
  `gh secret set AZURE_SIGNING_CLIENT_SECRET`.

A newly signed installer can still show a SmartScreen prompt until the
certificate builds reputation.
