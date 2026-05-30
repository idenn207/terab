import { renderPowerShellMountScript } from './script-template';

const baseArgs = {
  portalHost: '192.168.0.5',
  portalPort: 3260,
  iqn: 'iqn.2026-05.com.terab:drive-1',
  chapUsername: 'mount-cred-abc',
  chapPassword: 'base64url-safe_value-1',
  driveName: '내 드라이브',
  issuedAt: new Date('2026-05-30T12:00:00.000Z'),
};

describe('renderPowerShellMountScript', () => {
  it('필수 cmdlet 4종이 출력에 모두 포함', () => {
    const script = renderPowerShellMountScript(baseArgs);
    expect(script).toContain('Set-Service -Name MSiSCSI -StartupType Automatic');
    expect(script).toContain('Start-Service MSiSCSI');
    expect(script).toContain('New-IscsiTargetPortal -TargetPortalAddress "192.168.0.5"');
    expect(script).toContain('Connect-IscsiTarget');
    expect(script).toContain('-AuthenticationType ONEWAYCHAP');
    expect(script).toContain('-ChapUsername "mount-cred-abc"');
    expect(script).toContain('-ChapSecret "base64url-safe_value-1"');
  });

  it('args 그대로 치환되어 {{placeholder}} 잔존 0건', () => {
    const script = renderPowerShellMountScript(baseArgs);
    expect(script).not.toMatch(/\{\{/);
  });

  it('PowerShell 특수문자 " 가 들어가면 backtick escape', () => {
    const script = renderPowerShellMountScript({ ...baseArgs, chapPassword: 'a"b' });
    expect(script).toContain('-ChapSecret "a`"b"');
  });

  it('PowerShell 특수문자 $ 가 들어가면 backtick escape (변수 보간 차단)', () => {
    const script = renderPowerShellMountScript({ ...baseArgs, chapPassword: 'x$evil' });
    expect(script).toContain('-ChapSecret "x`$evil"');
  });

  it('PowerShell backtick 이 들어가면 두 개로 escape', () => {
    const script = renderPowerShellMountScript({ ...baseArgs, chapPassword: 'a`b' });
    expect(script).toContain('-ChapSecret "a``b"');
  });

  it('header 주석에 발급 시각(ISO) + drive name 포함', () => {
    const script = renderPowerShellMountScript(baseArgs);
    expect(script).toContain('# Drive: 내 드라이브');
    expect(script).toContain('# Issued: 2026-05-30T12:00:00.000Z');
  });

  it('CRLF line ending 으로 종결 (Windows convention)', () => {
    const script = renderPowerShellMountScript(baseArgs);
    expect(script.endsWith('\r\n')).toBe(true);
    expect(script).toMatch(/\r\n/);
  });
});
