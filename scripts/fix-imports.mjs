import fs from 'fs';
import path from 'path';

const root = path.join(process.cwd(), 'src');

const utilMap = {
  'ledger-calculator': 'ledger/ledger-calculator',
  'balance-calculator': 'ledger/balance-calculator',
  'settlement-display': 'ledger/settlement-display',
  'interest-calculator': 'ledger/interest-calculator',
  'debt-consolidation': 'consolidation/debt-consolidation',
  'member-color': 'display/member-color',
  'dashboard-insights': 'display/dashboard-insights',
  'audit-formatter': 'display/audit-formatter',
  'kaomoji-pools': 'display/kaomoji-pools',
  'firestore-data': 'infra/firestore-data',
  'image-compress': 'infra/image-compress',
  'login-prefs': 'infra/login-prefs',
  'expense-date': 'infra/expense-date',
};

const componentMap = {
  'member-avatar': 'member/member-avatar',
  'member-chibi-head': 'member/member-chibi-head',
  'member-net-chips': 'member/member-net-chips',
  'member-picker': 'member/member-picker',
  'member-select-grid': 'member/member-select-grid',
  'inline-transaction-list': 'ledger/inline-transaction-list',
  'settlement-sheet': 'ledger/settlement-sheet',
  'transfer-breakdown': 'ledger/transfer-breakdown',
  'split-pie-chart': 'ledger/split-pie-chart',
  'interest-estimate': 'ledger/interest-estimate',
  'date-field': 'form/date-field',
  'view-switch': 'form/view-switch',
  'confirm-dialog': 'form/confirm-dialog',
  'app-logo': 'branding/app-logo',
  'avatar-picker': 'branding/avatar-picker',
  'deco-illustration': 'branding/deco-illustration',
  'kaomoji-deco': 'branding/kaomoji-deco',
  'kaomoji-loading': 'branding/kaomoji-loading',
};

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|html)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function transform(content, file) {
  let out = content;

  // firebase
  out = out.replace(/(['"])(\.\.\/)+firebase\1/g, "$1../config/firebase$1");
  out = out.replace(/from ['"]\.\/firebase['"]/g, "from '../config/firebase'");
  out = out.replace(/from ['"]\.\.\/firebase['"]/g, "from '../config/firebase'");

  // core/utils -> domain paths
  for (const [name, target] of Object.entries(utilMap)) {
    const re = new RegExp(`core/utils/${name}`, 'g');
    out = out.replace(re, `core/${target}`);
  }
  // transactions folder (advance-*, split-*, transaction-*)
  out = out.replace(/core\/utils\/(advance-[a-z-]+)/g, 'core/transactions/$1');
  out = out.replace(/core\/utils\/split-calculator/g, 'core/transactions/split-calculator');
  out = out.replace(/core\/utils\/(transaction-[a-z-]+)/g, 'core/transactions/$1');

  // shared components
  for (const [name, target] of Object.entries(componentMap)) {
    const re = new RegExp(`shared/components/${name}\\.component`, 'g');
    out = out.replace(re, `shared/components/${target}.component`);
  }

  // routes
  out = out.replace(
    /features\/transactions\/transaction-list\.component/g,
    'features/transactions/list/transaction-list.component'
  );
  out = out.replace(
    /features\/transactions\/transaction-detail\.component/g,
    'features/transactions/detail/transaction-detail.component'
  );
  out = out.replace(
    /features\/transactions\/transaction-create\.component/g,
    'features/transactions/create/transaction-create.component'
  );

  // depth fix: nested shared/components/* and features/transactions/*
  if (
    file.includes('/shared/components/') &&
    /\/shared\/components\/[^/]+\//.test(file)
  ) {
    out = out.replace(/from '\.\.\/\.\.\/core\//g, "from '../../../core/");
    out = out.replace(/from '\.\.\/\.\.\/copy/g, "from '../../../copy");
    out = out.replace(/from '\.\.\/\.\.\/shared\//g, "from '../../../shared/");
    out = out.replace(
      /from '\.\.\/pipes\//g,
      "from '../../../shared/pipes/"
    );
    out = out.replace(
      /from '\.\.\/constants\//g,
      "from '../../../shared/constants/"
    );
  }

  if (file.includes('/features/transactions/') && /\/transactions\/[^/]+\//.test(file)) {
    out = out.replace(/from '\.\.\/\.\.\/core\//g, "from '../../../core/");
    out = out.replace(/from '\.\.\/\.\.\/shared\//g, "from '../../../shared/");
    out = out.replace(/from '\.\.\/\.\.\/copy/g, "from '../../../copy");
  }

  if (file.includes('/shared/pipes/')) {
    out = out.replace(/from '\.\.\/\.\.\/core\//g, "from '../../../core/");
  }

  // cross-domain relative imports inside core (./foo from old utils)
  out = out.replace(
    /from '\.\/ledger-calculator'/g,
    "from '../ledger/ledger-calculator'"
  );
  out = out.replace(
    /from '\.\/settlement-display'/g,
    "from '../ledger/settlement-display'"
  );
  out = out.replace(
    /from '\.\/debt-consolidation'/g,
    "from '../consolidation/debt-consolidation'"
  );
  out = out.replace(
    /from '\.\/transaction-date'/g,
    "from '../transactions/transaction-date'"
  );
  out = out.replace(
    /from '\.\/transaction-summary'/g,
    "from '../transactions/transaction-summary'"
  );
  out = out.replace(
    /from '\.\/advance-allocation'/g,
    "from '../transactions/advance-allocation'"
  );

  return out;
}

for (const file of walk(root)) {
  const original = fs.readFileSync(file, 'utf8');
  const updated = transform(original, file);
  if (updated !== original) {
    fs.writeFileSync(file, updated);
    console.log('updated', path.relative(process.cwd(), file));
  }
}
