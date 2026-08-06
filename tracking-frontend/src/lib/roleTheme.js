export const ROLE_THEME = {
  STUDENT: {
    label: 'Student',
    accent: 'text-sky-600',
    accentSoft: 'bg-sky-50 text-sky-700 border-sky-100',
    chip: 'bg-sky-500',
    ring: 'focus:ring-sky-500/30 focus:border-sky-500',
    button: 'bg-sky-600 hover:bg-sky-500',
    badge: 'bg-sky-100 text-sky-700',
  },
  TEACHER: {
    label: 'Teacher',
    accent: 'text-emerald-600',
    accentSoft: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    chip: 'bg-emerald-500',
    ring: 'focus:ring-emerald-500/30 focus:border-emerald-500',
    button: 'bg-emerald-600 hover:bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  HOD: {
    label: 'HOD',
    accent: 'text-violet-600',
    accentSoft: 'bg-violet-50 text-violet-700 border-violet-100',
    chip: 'bg-violet-500',
    ring: 'focus:ring-violet-500/30 focus:border-violet-500',
    button: 'bg-violet-600 hover:bg-violet-500',
    badge: 'bg-violet-100 text-violet-700',
  },
};

export function themeFor(role) {
  return ROLE_THEME[role] ?? ROLE_THEME.STUDENT;
}
