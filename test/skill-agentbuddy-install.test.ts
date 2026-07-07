import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  installAgentbuddySkill,
  readSkillRegistry,
  removeInstalledSkill,
  updateInstalledSkill,
} from '../src/services/skill-registry-store.js';

// A stand-in for the real `agentbuddy` CLI. It writes the SKILL.md tree that the
// real binary would produce with `--agent claude-code --copy` into $CWD, so the
// wrapper's capture+register path is exercised without any network/SSO.
const FAKE_AGENTBUDDY = `
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
if (process.env.FAKE_AB_FAIL === '1') { process.stderr.write('needs login\\n'); process.exit(1); }
if (process.env.FAKE_AB_EMPTY === '1') { process.exit(0); }
const argv = process.argv.slice(2);
function writeSkill(name, desc) {
  const dir = join(process.cwd(), '.claude', 'skills', name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), '---\\nname: ' + name + '\\ndescription: ' + desc + '\\n---\\n# ' + name);
  writeFileSync(join(dir, 'helper.md'), 'resource for ' + name);
}
if (argv[1] === 'collection') {
  const uid = argv[3];
  writeSkill(uid + '-alpha', 'from collection ' + uid);
  writeSkill(uid + '-beta', 'from collection ' + uid);
} else {
  const i = argv.indexOf('--skill');
  const name = i >= 0 ? argv[i + 1] : 'unnamed';
  const v = argv.indexOf('--version');
  writeSkill(name, v >= 0 ? ('v' + argv[v + 1]) : 'latest');
}
`;

describe('agentbuddy skill install', () => {
  let home: string;
  let fakeBin: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'botmux-ab-home-'));
    vi.stubEnv('HOME', home);
    fakeBin = join(mkdtempSync(join(tmpdir(), 'botmux-ab-bin-')), 'fake-agentbuddy.cjs');
    writeFileSync(fakeBin, FAKE_AGENTBUDDY);
    vi.stubEnv('BOTMUX_AGENTBUDDY_CMD', `node ${fakeBin}`);
    vi.stubEnv('FAKE_AB_FAIL', '');
    vi.stubEnv('FAKE_AB_EMPTY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(home, { recursive: true, force: true });
  });

  it('installs a single skill and records an agentbuddy source', () => {
    const pkgs = installAgentbuddySkill({ group: 'code.byted.org/team/mkt', skill: 'deploy', version: '1.2.3' });

    expect(pkgs.map((p) => p.name)).toEqual(['deploy']);
    const skill = readSkillRegistry().skills.deploy;
    expect(skill.description).toBe('v1.2.3');
    expect(skill.source).toEqual({
      type: 'agentbuddy',
      identifier: 'code.byted.org/team/mkt/deploy@1.2.3',
      group: 'code.byted.org/team/mkt',
      skill: 'deploy',
      version: '1.2.3',
    });
    // bundled resources are copied into the store alongside SKILL.md
    expect(existsSync(join(skill.rootDir, 'helper.md'))).toBe(true);
  });

  it('installs every skill in a collection, each re-installable via the collection', () => {
    const pkgs = installAgentbuddySkill({ collection: 'vwx6HZoo' });

    expect(pkgs.map((p) => p.name).sort()).toEqual(['vwx6HZoo-alpha', 'vwx6HZoo-beta']);
    expect(readSkillRegistry().skills['vwx6HZoo-alpha'].source).toEqual({
      type: 'agentbuddy',
      identifier: 'collection/vwx6HZoo',
      collection: 'vwx6HZoo',
      skill: 'vwx6HZoo-alpha',
    });
  });

  it('updates an installed agentbuddy skill by re-running its source', () => {
    installAgentbuddySkill({ group: 'code.byted.org/team/mkt', skill: 'deploy', version: '1.2.3' });
    const result = updateInstalledSkill('deploy');

    expect(result.ok).toBe(true);
    expect(readSkillRegistry().skills.deploy.source).toMatchObject({ type: 'agentbuddy', version: '1.2.3' });
  });

  it('removes the store copy on uninstall', () => {
    const [pkg] = installAgentbuddySkill({ group: 'g/h', skill: 'deploy' });
    expect(existsSync(pkg.rootDir)).toBe(true);

    expect(removeInstalledSkill('deploy')).toEqual({ ok: true });
    expect(readSkillRegistry().skills.deploy).toBeUndefined();
    expect(existsSync(pkg.rootDir)).toBe(false);
  });

  it('surfaces a clean error when the CLI is missing or unauthenticated', () => {
    vi.stubEnv('BOTMUX_AGENTBUDDY_CMD', join(home, 'does-not-exist'));
    expect(() => installAgentbuddySkill({ group: 'g/h', skill: 'deploy' })).toThrow(/agentbuddy_not_found/);

    vi.stubEnv('BOTMUX_AGENTBUDDY_CMD', `node ${fakeBin}`);
    vi.stubEnv('FAKE_AB_FAIL', '1');
    expect(() => installAgentbuddySkill({ group: 'g/h', skill: 'deploy' })).toThrow(/agentbuddy_command_failed: .*needs login/);
  });

  it('errors when the CLI produces no skill', () => {
    vi.stubEnv('FAKE_AB_EMPTY', '1');
    expect(() => installAgentbuddySkill({ group: 'g/h', skill: 'deploy' })).toThrow(/agentbuddy_no_skill_produced/);
  });
});
