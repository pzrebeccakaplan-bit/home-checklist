// Vercel preview builds (any branch other than main) run against the TEST database
// with the login skipped, so new features can be tried without touching real data.
// The production site never has "-git-" in its address.
const host = typeof window !== 'undefined' ? window.location.hostname : ''

export const IS_PREVIEW =
  import.meta.env.VITE_VERCEL_ENV === 'preview' || /-git-/.test(host)

// Test (dev) Supabase project. Publishable keys are safe to ship in client code.
export const DEV_SUPABASE = {
  url: 'https://qackkxtgslutyidmfjdw.supabase.co',
  key: 'sb_publishable_fl32tAGXTPepJ6vUM8PcPg_asOjj1fm',
}
