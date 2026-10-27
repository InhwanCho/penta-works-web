export function alertSettingsPageUrl(siteId: string, pathname: string, options: {metric?: string; pane?: string; only?: string}) {
  const query = new URLSearchParams();
  if (options.metric) query.set('metric', options.metric);
  if (options.pane) query.set('pane', options.pane);
  if (options.only) query.set('only', options.only);
  query.set('return', /^\/sites\/[^/?#]+$/.test(pathname) ? `${pathname}#hospital-alert-summary` : pathname === '/' ? '/?view=alerts' : '/baselines?view=thresholds');
  return `/alert-settings/${encodeURIComponent(siteId)}?${query}`;
}
