import { Switch } from '@headlessui/react';
import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import { useDarkMode } from '../../providers/DarkModeProvider';

export const DarkModeToggle = () => {
  const { isDark, setDarkMode } = useDarkMode();

  return (
    <Switch
      checked={isDark}
      onChange={setDarkMode}
      className="group inline-flex h-8 w-14 items-center rounded-full bg-slate-200 p-1 transition data-[checked]:bg-primary-600 dark:bg-slate-700 dark:data-[checked]:bg-primary-500"
      aria-label="Toggle dark mode"
    >
      <span className="sr-only">Dark mode</span>
      <span className="inline-flex h-6 w-6 translate-x-0 items-center justify-center rounded-full bg-white text-slate-700 transition group-data-[checked]:translate-x-6 group-data-[checked]:text-primary-600 dark:bg-slate-900 dark:text-slate-300 dark:group-data-[checked]:text-primary-300">
        {isDark ? <MoonIcon className="h-3.5 w-3.5" /> : <SunIcon className="h-3.5 w-3.5" />}
      </span>
    </Switch>
  );
};
