import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const requiredFiles = [
  'AGENTS.md',
  'CLAUDE.md',
  'ARCHITECTURE.md',
  'README.md',
  'docs/prd.md',
  'docs/FRONTEND.md',
  'docs/BACKEND.md',
  'docs/API_CONTRACT.md',
  'docs/TESTING.md',
  'docs/RUNBOOK.md',
  'docs/HARNESS.md',
  '.github/workflows/verify.yml',
];

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) failures.push(`缺少必需文件：${file}`);
}

const claude = readFileSync(resolve(root, 'CLAUDE.md'), 'utf8');
if (!claude.includes('@AGENTS.md')) failures.push('CLAUDE.md 必须导入 @AGENTS.md');

const markdownFiles = [];
const collectMarkdown = (directory) => {
  for (const entry of readdirSync(directory)) {
    if (entry === '.git' || entry === 'node_modules') continue;
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) collectMarkdown(path);
    else if (extname(path) === '.md') markdownFiles.push(path);
  }
};
collectMarkdown(root);

const linkPattern = /\[[^\]]*]\(([^)]+)\)/g;
for (const file of markdownFiles) {
  const content = readFileSync(file, 'utf8');
  for (const [, rawTarget] of content.matchAll(linkPattern)) {
    const target = rawTarget.replace(/^<|>$/g, '').split('#', 1)[0];
    if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
    if (!existsSync(resolve(dirname(file), decodeURIComponent(target)))) {
      failures.push(`${file.slice(root.length + 1)}：无效本地链接 ${rawTarget}`);
    }
  }
}

const contract = readFileSync(resolve(root, 'docs/API_CONTRACT.md'), 'utf8');
for (const prefix of ['AUTH', 'QRY', 'RPC', 'STO']) {
  const last = { AUTH: 7, QRY: 3, RPC: 5, STO: 3 }[prefix];
  for (let index = 1; index <= last; index += 1) {
    const id = `${prefix}-${String(index).padStart(2, '0')}`;
    if (!contract.includes(id)) failures.push(`API_CONTRACT.md 缺少接口编号：${id}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`文档检查通过：${markdownFiles.length} 个 Markdown`);
