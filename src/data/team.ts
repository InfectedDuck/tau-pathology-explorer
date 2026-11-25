/**
 * Who made this project. Shown in the About dialog, the page footer and the
 * storyboard export; mirrored in README.md, CITATION.cff and package.json.
 * Add more team members to `members` as needed.
 */
export interface TeamMember {
  name: string
  role: { en: string; tr: string }
}

export const PROJECT = {
  title: 'Tau Pathology Explorer',
  year: 2026,
  university: 'Semey Medical University',
  city: 'Semey, Kazakhstan',
  members: [
    { name: 'Kelsingazin Alikhan', role: { en: 'Project author', tr: 'Proje sahibi' } },
    { name: 'Toktar Kametay', role: { en: 'Web development and 3D visualisation', tr: 'Web geliştirme ve 3B görselleştirme' } },
  ] satisfies TeamMember[],
  repository: 'https://github.com/InfectedDuck/tau-pathology-explorer',
  website: 'https://tau-pathology-explorer.vercel.app',
}

/** "Kelsingazin Alikhan and team" */
export function authorLine(lang: 'en' | 'tr'): string {
  const lead = PROJECT.members[0].name
  return lang === 'tr' ? `${lead} ve ekibi` : `${lead} and team`
}
