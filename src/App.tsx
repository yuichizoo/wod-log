import { useState } from 'react';
import RecordPage from './pages/RecordPage';
import DashboardPage from './pages/DashboardPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';

const TABS = [
  { id: 'record', label: '記録', icon: '📝' },
  { id: 'dashboard', label: 'グラフ', icon: '📊' },
  { id: 'history', label: '履歴', icon: '📅' },
  { id: 'settings', label: '設定', icon: '⚙️' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function App() {
  const [tab, setTab] = useState<TabId>('record');

  return (
    <div className="mx-auto min-h-screen max-w-md pb-28">
      <header className="px-4 pb-1 pt-4">
        <h1 className="text-xl font-black tracking-tight">🏋️ WOD Log</h1>
      </header>
      <main className="px-4 pt-2">
        {tab === 'record' && <RecordPage />}
        {tab === 'dashboard' && <DashboardPage />}
        {tab === 'history' && <HistoryPage />}
        {tab === 'settings' && <SettingsPage />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${
                tab === t.id ? 'font-bold text-orange-500' : 'text-gray-500'
              }`}
            >
              <span className="text-xl leading-none">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
