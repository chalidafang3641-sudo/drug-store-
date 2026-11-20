import { browser } from '$app/environment';
import { error, redirect } from '@sveltejs/kit';

// Only the active browser session can reuse aggregates. SSR always starts fresh.
let saved;

export async function load({ fetch, parent, url }) {
  const { user } = await parent();
  if (!user) redirect(303, '/login');
  const query = new URLSearchParams();
  for (const key of ['filter', 'size', 'page', 'q']) {
    const value = url.searchParams.get(key);
    if (value) query.set(key, value);
  }
  const owner = user.id ?? user.username;
  const previous = browser && saved?.owner === owner ? saved : null;
  const response = await fetch('/dashboard/data?' + query, {
    headers: previous?.version ? { 'x-dashboard-version': previous.version } : {}
  });
  if (response.redirected && new URL(response.url).pathname === '/login') redirect(303, '/login');
  if (!response.ok) error(response.status, 'โหลดข้อมูลภาพรวมไม่สำเร็จ');
  const result = await response.json();
  const aggregates = result.summary ? {
    summary: result.summary, thresholds: result.thresholds, lowStock: result.low_stock,
    byLocation: result.by_location, total: result.total
  } : previous.aggregates;
  if (browser) saved = { owner, version: result.version, aggregates };
  return { ...aggregates, user, filter: result.filter, page: result.page, size: result.size,
    pages: Math.max(1, Math.ceil(aggregates.total / result.size)), q: result.q,
    searchResults: result.searchResults, near: result.near };
}
