/**
 * Who made this project. Shown in the About dialog, the page footer and the
 * storyboard export; mirrored in README.md, CITATION.cff and package.json.
 */
export interface Person {
  name: string
  role: { en: string; tr: string }
}

export const PROJECT = {
  title: 'Tau Pathology Explorer',
  year: 2026,
  university: 'Semey Medical University',
  city: 'Semey, Kazakhstan',
  /** the people whose project this is */
  authors: [
    { name: 'Erzhanuly Nursultan', role: { en: 'Project author', tr: 'Proje yazarı' } },
    { name: 'Kelsingazin Alikhan', role: { en: 'Project author', tr: 'Proje yazarı' } },
  ] satisfies Person[],
  /** who built the website */
  website: { name: 'Toktar Kametay', role: { en: 'Website development and 3D visualisation', tr: 'Web sitesi geliştirme ve 3B görselleştirme' } } satisfies Person,
  repository: 'https://github.com/InfectedDuck/tau-pathology-explorer',
  url: 'https://tau-pathology-explorer.vercel.app',
}

/** "Erzhanuly Nursultan and Kelsingazin Alikhan" */
export function authorLine(lang: 'en' | 'tr'): string {
  const names = PROJECT.authors.map((a) => a.name)
  const and = lang === 'tr' ? ' ve ' : ' and '
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')}${and}${names[names.length - 1]}`
}
