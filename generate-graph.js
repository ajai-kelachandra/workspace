const fs = require('fs'), path = require('path');
const root = process.argv[2];
const exts = ['.ts', '.tsx', '.js', '.jsx'];
const roots = ['app', 'components', 'utils', 'hooks', 'i18n'];
const top = ['config.ts', 'middleware.ts'];
const files = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!['node_modules', '.next'].includes(e.name)) walk(p); }
    else if (exts.includes(path.extname(e.name)) && !e.name.endsWith('.d.ts')) files.push(p);
  }
}
roots.forEach(r => walk(path.join(root, r)));
top.forEach(t => files.push(path.join(root, t)));
const rel = f => path.relative(root, f).split(path.sep).join('/');
const set = new Set(files.map(rel));
const rules = [
  ['M2-auth', /(SignIn|Create-Account|ForgotPassword|ChangePassword|AuthInterceptor|userContext|\/login\/|\/register\/|forgot-password|change-password|VerifyEmailId|VerifyYourEmailIdOTP|\/migrate\/)/],
  ['M5-event-dashboard', /(EventDashboard|event-dashboard)/],
  ['M3-profile', /(MyProfile|\/Profile\/|ProfileContext|LeadersProfile|CompleteProfileModal|\/my-profile|\/edit-profile|\/profile\/|member-profile-search|fetchProfile)/],
  ['M4-events', /(\/Events\/|EventDetail|event-detail|getEventTypeLabel)/],
  ['M6-rewards', /(Rewards|RewardInfo|reward-info|rewards\/|useMerchandiseVoucher)/],
  ['M9-feedback', /(CSAT|NPS|csatHelpers)/],
  ['M7-products', /(Products|ProductRegistration|\/product|\/gear|memory-cards|sony-microphones|SonyMicroScope|product-registrations)/],
  ['M10-contests', /(Contest|contest|AlphaAmbassadors|ambassadors|Collaborators|collaborators|Alpha-Members|influencer|sony-africa-photo|africa-photo)/],
  ['M11-support', /(ProSupport|pro-support|StoreLocator|store-locator|SensorCleaning|sensor-cleaning|Sony-sensor|\/Faq|\/faq|contact-us|qr-scan|OrangeFriday)/],
  ['M12-analytics-media', /(webengage|VideoPlayer|JWPlayer|videoApi|WebView)/],
  ['M8-content', /(Stories|stories|Gallery|gallery|Sports|sports|Wedding|wedding|Wildlife|wildlife|Fashion|genre|DynamicPages|Podcast|podcast|Tutorial|tutorial|CreativeCrib|creative-crib|lens-reels|LensRecomendations|alpha-femme|AlphaFemme|G-master|g-master|Cinematography|campaign|Flix|WhatsNew|deals|regional|RegionalLaunches|Membership|membership)/],
];
const modOf = f => { for (const [m, r] of rules) if (r.test('/' + f)) return m; return 'M1-foundation'; };
const typeOf = f => {
  if (f === 'middleware.ts') return 'middleware';
  if (f === 'config.ts') return 'config';
  if (/layout\.tsx$/.test(f)) return 'layout';
  if (/\/page\.tsx$/.test(f)) return 'page';
  if (/Context\.tsx$|userContext/.test(f)) return 'context';
  if (f.startsWith('hooks/') || /CustomHooks/.test(f)) return 'hook';
  if (f.startsWith('utils/')) return 'util';
  if (f.startsWith('i18n/')) return 'i18n';
  return 'component';
};
function resolve(from, spec) {
  let base;
  if (spec.startsWith('@/')) base = spec.slice(2);
  else if (spec.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  else return null;
  const c = [base, ...exts.map(e => base + e), ...exts.map(e => base + '/index' + e)];
  return c.find(x => set.has(x)) || null;
}
const nodes = [], edges = [], apis = new Map();
const importRe = /(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const apiRe = /\/api\/[a-zA-Z0-9_\-/]+/g;
const extern = { webengage: /webengage/i, clarity: /@microsoft\/clarity/, recaptcha: /recaptcha/i, jwplayer: /jwplayer/i, axios: /from ['"]axios['"]/ };
for (const f of files) {
  const id = rel(f), src = fs.readFileSync(f, 'utf8');
  const imps = new Set();
  let m;
  importRe.lastIndex = 0;
  while ((m = importRe.exec(src))) { const t = resolve(id, m[1] || m[2]); if (t && t !== id) imps.add(t); }
  const a = new Set((src.match(apiRe) || []).map(s => s.replace(/\/+$/, '')).filter(s => s.length > 6));
  const ext = Object.entries(extern).filter(([k, r]) => r.test(src)).map(([k]) => k);
  nodes.push({ id, kind: 'file', type: typeOf(id), module: modOf(id), path: id, lines: src.split('\n').length,
    usesAuthToken: /Bearer|\.token|userToken/.test(src), client: /^\s*['"]use client['"]/m.test(src.slice(0, 200)) });
  imps.forEach(t => edges.push({ from: id, to: t, kind: 'imports', verified: true }));
  a.forEach(p => { apis.set(p, (apis.get(p) || 0) + 1); edges.push({ from: id, to: 'api:' + p, kind: 'calls', verified: true }); });
  ext.forEach(e => edges.push({ from: id, to: 'ext:' + e, kind: 'uses', verified: true }));
}
const modMeta = {
  'M1-foundation': 'Layout, NavBar, home, locale middleware, config',
  'M2-auth': 'Login, register, OTP, password flows, session, AuthInterceptor',
  'M3-profile': 'Profile view/edit, gear, gallery, ProfileContext',
  'M4-events': 'Public events: browse, register, pay, attend',
  'M5-event-dashboard': 'Event create/draft/review/revision/posted (is_pic users)',
  'M6-rewards': 'Points, vouchers, merchandise, transfers',
  'M7-products': 'Catalogue, product registration',
  'M8-content': 'Stories, gallery, genre pages, podcasts, tutorials',
  'M9-feedback': 'CSAT and NPS modals',
  'M10-contests': 'Contests, ambassadors, collaborators, influencer',
  'M11-support': 'Service centres, FAQ, pro support, contact',
  'M12-analytics-media': 'WebEngage, video player, watch time' };
const kw = {
  'M2-auth': ['login', 'logout', 'sign in', 'register', 'signup', 'password', 'otp', 'token', 'session', 'verify email'],
  'M3-profile': ['profile', 'avatar', 'account', 'edit profile', 'gear', 'country'],
  'M4-events': ['event', 'registration', 'ticket', 'payment', 'attend', 'workshop'],
  'M5-event-dashboard': ['dashboard', 'draft', 'revision', 'speaker', 'publish event', 'create event', 'pic'],
  'M6-rewards': ['reward', 'points', 'voucher', 'redeem', 'merchandise', 'transfer'],
  'M7-products': ['product', 'camera', 'lens', 'serial', 'seller', 'gear page'],
  'M8-content': ['story', 'gallery', 'genre', 'wedding', 'sports', 'wildlife', 'podcast', 'tutorial', 'like'],
  'M9-feedback': ['csat', 'nps', 'survey', 'feedback', 'rating'],
  'M10-contests': ['contest', 'award', 'ambassador', 'collaborator', 'influencer'],
  'M11-support': ['support', 'service centre', 'store', 'faq', 'contact', 'sensor cleaning'],
  'M12-analytics-media': ['analytics', 'webengage', 'video', 'player', 'tracking'],
  'M1-foundation': ['navbar', 'footer', 'layout', 'locale', 'language', 'i18n', 'home', 'theme', 'seo', 'middleware', 'config'] };
const modules = Object.keys(modMeta).map(id => ({ id, description: modMeta[id], keywords: kw[id], files: nodes.filter(n => n.module === id).length }));
const modEdge = {};
const nm = Object.fromEntries(nodes.map(n => [n.id, n.module]));
for (const e of edges) if (e.kind === 'imports') { const a = nm[e.from], b = nm[e.to]; if (a !== b) { const k = a + '>' + b; modEdge[k] = (modEdge[k] || 0) + 1; } }
const moduleEdges = Object.entries(modEdge).map(([k, w]) => { const [from, to] = k.split('>'); return { from, to, kind: 'depends_on', weight: w }; });
const apiNodes = [...apis.entries()].map(([p, c]) => ({ id: 'api:' + p, kind: 'api', type: 'endpoint', path: p, callSites: c, method: 'needs-verification' }));
const extNodes = Object.keys(extern).map(k => ({ id: 'ext:' + k, kind: 'external', type: 'service' }));
const out = { schemaVersion: '1.0', generatedAt: new Date().toISOString(), repo: 'sony-alpha',
  note: 'Generated by static scan of import statements and /api/ string literals. Edges are matched by regex, not type resolution. Dynamic imports with computed paths and API paths built from variables may be missed. Module assignment is by path heuristics. Database tables are not in this repo and are not included.',
  modules, moduleEdges, nodes: [...nodes, ...apiNodes, ...extNodes], edges };
fs.writeFileSync(path.join(root, 'docs/architecture/architecture.graph.json'), JSON.stringify(out, null, 1));
const fanIn = {};
edges.filter(e => e.kind === 'imports').forEach(e => fanIn[e.to] = (fanIn[e.to] || 0) + 1);
const top10 = Object.entries(fanIn).sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log(JSON.stringify({ files: nodes.length, apis: apiNodes.length, edges: edges.length, moduleEdges: moduleEdges.length, modules: modules.map(m => m.id + ':' + m.files), top10 }, null, 1));
