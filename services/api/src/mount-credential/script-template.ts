export interface PowerShellMountScriptArgs {
  portalHost: string;
  portalPort: number;
  iqn: string;
  chapUsername: string;
  chapPassword: string;
  driveName: string;
  issuedAt: Date;
}

function escapeDoubleQuotedPwsh(value: string): string {
  return value.replace(/`/g, '``').replace(/\$/g, '`$').replace(/"/g, '`"');
}

export function renderPowerShellMountScript(args: PowerShellMountScriptArgs): string {
  const portalHost = escapeDoubleQuotedPwsh(args.portalHost);
  const iqn = escapeDoubleQuotedPwsh(args.iqn);
  const chapUsername = escapeDoubleQuotedPwsh(args.chapUsername);
  const chapPassword = escapeDoubleQuotedPwsh(args.chapPassword);
  const driveName = escapeDoubleQuotedPwsh(args.driveName);

  const lines = [
    `# Terab iSCSI mount script`,
    `# Drive: ${driveName}`,
    `# Issued: ${args.issuedAt.toISOString()}`,
    ``,
    `Set-Service -Name MSiSCSI -StartupType Automatic`,
    `Start-Service MSiSCSI`,
    ``,
    `New-IscsiTargetPortal -TargetPortalAddress "${portalHost}" -TargetPortalPortNumber ${args.portalPort}`,
    ``,
    `Connect-IscsiTarget \`\r\n  -NodeAddress "${iqn}" \`\r\n  -IsPersistent $true \`\r\n  -AuthenticationType ONEWAYCHAP \`\r\n  -ChapUsername "${chapUsername}" \`\r\n  -ChapSecret "${chapPassword}"`,
    ``,
    `Get-Disk | Where-Object { $_.OperationalStatus -eq 'Offline' } | Set-Disk -IsOffline $false`,
  ];

  return lines.join('\r\n') + '\r\n';
}
