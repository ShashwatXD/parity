import { execFile } from 'node:child_process';
import { platform } from 'node:os';
import { promisify } from 'node:util';
import { useHostDirectory } from './browse.js';

const execFileAsync = promisify(execFile);


export async function pickNativeDirectory(): Promise<{ root: string }> {
  const os = platform();
  let chosen = '';

  if (os === 'darwin') {
    const { stdout } = await execFileAsync(
      'osascript',
      ['-e', 'POSIX path of (choose folder with prompt "Select Parity workspace")'],
      { timeout: 300_000, maxBuffer: 1024 * 1024 },
    );
    chosen = String(stdout).trim().replace(/\/$/, '');
  } else if (os === 'linux') {
    try {
      const { stdout } = await execFileAsync(
        'zenity',
        ['--file-selection', '--directory', '--title=Select Parity workspace'],
        { timeout: 300_000 },
      );
      chosen = String(stdout).trim();
    } catch {
      const { stdout } = await execFileAsync(
        'kdialog',
        ['--getexistingdirectory', '.', '--title', 'Select Parity workspace'],
        { timeout: 300_000 },
      );
      chosen = String(stdout).trim();
    }
  } else if (os === 'win32') {
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms',
      '$d = New-Object System.Windows.Forms.FolderBrowserDialog',
      '$d.Description = "Select Parity workspace"',
      'if ($d.ShowDialog() -eq "OK") { $d.SelectedPath }',
    ].join('; ');
    const { stdout } = await execFileAsync(
      'powershell',
      ['-NoProfile', '-Command', script],
      { timeout: 300_000 },
    );
    chosen = String(stdout).trim();
  } else {
    throw new Error(`Native folder picker not supported on ${os}`);
  }

  if (!chosen) {
    throw new Error('Folder selection cancelled');
  }

  return useHostDirectory(chosen);
}
