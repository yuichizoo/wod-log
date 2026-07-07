import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from 'recharts';
import { db } from '../db/db';
import type { Exercise, Session } from '../types';
import {
  joinSetsWithDate,
  e1rmSeries,
  weeklyVolume,
  rpeSeries,
  categoryBalance,
  conditionPerformance,
  conditionInsight,
  konjoCount,
  computePrHistory,
  type SetWithDate,
} from '../lib/stats';
import { formatDateShort, formatDateJP, daysAgoISO } from '../lib/format';

const ORANGE = '#f97316';
const SKY = '#0ea5e9';
const VIOLET = '#8b5cf6';

const PERIODS = [
  { id: '1M', days: 30 },
  { id: '3M', days: 90 },
  { id: '6M', days: 180 },
  { id: 'ALL', days: 0 },
] as const;

export default function DashboardPage() {
  const data = useLiveQuery(async () => {
    const [sessions, sets, exercises] = await Promise.all([
      db.sessions.toArray(),
      db.sets.toArray(),
      db.exercises.toArray(),
    ]);
    return { sessions, sets, exercises };
  }, []);

  const joined = useMemo(
    () => (data ? joinSetsWithDate(data.sessions, data.sets) : []),
    [data],
  );
  const prEvents = useMemo(
    () => (data ? computePrHistory(joined, data.exercises) : []),
    [data, joined],
  );

  if (!data) return null;
  const { sessions, exercises } = data;

  if (joined.length === 0) {
    return (
      <div className="card text-sm text-gray-500">
        まだ記録がありません。「記録」タブから最初のトレーニングを記録しましょう 💪
      </div>
    );
  }

  const konjo = konjoCount(sessions);

  return (
    <div className="space-y-4">
      {konjo > 0 && (
        <div className="card flex items-center gap-3 border-orange-300 dark:border-orange-800">
          <span className="text-3xl">🔥</span>
          <div>
            <div className="font-black">気合い出席 {konjo}回</div>
            <div className="text-xs text-gray-500">
              低モチベーションでもジムに来た回数。一番えらいやつ。
            </div>
          </div>
        </div>
      )}
      <PrListCard prs={prEvents} />
      <E1rmCard joined={joined} exercises={exercises} />
      <WeeklyVolumeCard joined={joined} />
      <RpeCard sessions={sessions} />
      <RadarCard joined={joined} exercises={exercises} />
      <CondPerfCard sessions={sessions} joined={joined} />
    </div>
  );
}

function PrListCard({ prs }: { prs: ReturnType<typeof computePrHistory> }) {
  if (prs.length === 0) return null;
  const recent = prs.slice(-5).reverse();
  return (
    <div className="card space-y-2">
      <h2 className="font-bold">🏆 直近のPR</h2>
      {recent.map((pr, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="w-16 shrink-0 text-xs text-gray-500">
            {formatDateShort(pr.date)}
          </span>
          <span className="flex-1 truncate">
            <span className="font-medium">{pr.exerciseName}</span> {pr.message}
          </span>
          <span className="font-bold text-orange-500">
            {pr.oldValue != null ? `${pr.oldValue}→` : ''}
            {pr.newValue}
          </span>
        </div>
      ))}
    </div>
  );
}

function E1rmCard({ joined, exercises }: { joined: SetWithDate[]; exercises: Exercise[] }) {
  const withData = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const s of joined) {
      if (s.weight != null) countMap.set(s.exerciseId, (countMap.get(s.exerciseId) ?? 0) + 1);
    }
    return exercises
      .filter((e) => (countMap.get(e.id) ?? 0) > 0)
      .sort((a, b) => (countMap.get(b.id) ?? 0) - (countMap.get(a.id) ?? 0));
  }, [joined, exercises]);

  const [exId, setExId] = useState('');
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>('ALL');
  const effectiveId = exId || withData[0]?.id || '';

  const series = useMemo(() => {
    let s = e1rmSeries(joined, effectiveId);
    const p = PERIODS.find((p) => p.id === period)!;
    if (p.days > 0) {
      const cutoff = daysAgoISO(p.days);
      s = s.filter((d) => d.date >= cutoff);
    }
    return s;
  }, [joined, effectiveId, period]);

  if (withData.length === 0) return null;

  return (
    <div className="card space-y-3">
      <h2 className="font-bold">📈 推定1RMの推移</h2>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {withData.map((e) => (
          <button
            key={e.id}
            onClick={() => setExId(e.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              effectiveId === e.id
                ? 'bg-orange-500 text-white'
                : 'bg-stone-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {e.name}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`flex-1 rounded-lg py-1 text-xs font-bold ${
              period === p.id
                ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300'
                : 'text-gray-400'
            }`}
          >
            {p.id}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af33" />
          <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 10 }} />
          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
          <Tooltip
            labelFormatter={(l) => formatDateJP(String(l))}
            formatter={(v) => [`${v} kg`, '推定1RM']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={ORANGE}
            strokeWidth={2.5}
            dot={{ r: 3.5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function WeeklyVolumeCard({ joined }: { joined: SetWithDate[] }) {
  const data = useMemo(() => weeklyVolume(joined), [joined]);
  if (data.length === 0) return null;
  return (
    <div className="card space-y-2">
      <h2 className="font-bold">🏗️ 週次ボリューム (Σ 重量×回数)</h2>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af33" />
          <XAxis dataKey="week" tickFormatter={formatDateShort} tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            labelFormatter={(l) => `${formatDateShort(String(l))}の週`}
            formatter={(v) => [`${v} kg`, 'ボリューム']}
          />
          <Bar dataKey="volume" fill={SKY} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RpeCard({ sessions }: { sessions: Session[] }) {
  const data = useMemo(() => rpeSeries(sessions), [sessions]);
  if (data.length < 2) return null;
  return (
    <div className="card space-y-2">
      <h2 className="font-bold">😮‍💨 セッションRPEの推移</h2>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af33" />
          <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
          <Tooltip labelFormatter={(l) => formatDateJP(String(l))} />
          <Line type="monotone" dataKey="rpe" stroke={VIOLET} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function RadarCard({ joined, exercises }: { joined: SetWithDate[]; exercises: Exercise[] }) {
  const data = useMemo(() => categoryBalance(joined, exercises, 8), [joined, exercises]);
  const total = data.reduce((a, d) => a + d.count, 0);
  if (total === 0) return null;
  const weakest = [...data].sort((a, b) => a.count - b.count)[0];
  return (
    <div className="card space-y-1">
      <h2 className="font-bold">🕸️ カテゴリバランス (直近8週)</h2>
      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid stroke="#9ca3af55" />
          <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
          <Radar dataKey="count" stroke={ORANGE} fill={ORANGE} fillOpacity={0.35} />
          <Tooltip formatter={(v) => [`${v}回`, '記録回数']} />
        </RadarChart>
      </ResponsiveContainer>
      {weakest.count < total / 8 && (
        <div className="text-xs text-gray-500">
          💡 直近は「{weakest.category}」が少なめ。次回のメニュー候補に。
        </div>
      )}
    </div>
  );
}

function CondPerfCard({
  sessions,
  joined,
}: {
  sessions: Session[];
  joined: SetWithDate[];
}) {
  const cond = useMemo(
    () => conditionPerformance(sessions, joined, 'preCondition'),
    [sessions, joined],
  );
  const mot = useMemo(
    () => conditionPerformance(sessions, joined, 'motivation'),
    [sessions, joined],
  );
  if (cond.length === 0 && mot.length === 0) return null;

  const condEmojis = ['😫', '😕', '😐', '🙂', '💪'];
  const motEmojis = ['🥱', '😑', '😐', '😊', '🔥'];
  const insight = conditionInsight(cond, '体調') ?? conditionInsight(mot, 'モチベ');

  return (
    <div className="card space-y-3">
      <h2 className="font-bold">🧠 コンディション × パフォーマンス</h2>
      <p className="text-xs text-gray-500">
        段階別の「その日のe1RM達成率(当時ベスト比%)」平均
      </p>
      {cond.length > 0 && (
        <PerfBars title="体調別" groups={cond} emojis={condEmojis} color={ORANGE} />
      )}
      {mot.length > 0 && (
        <PerfBars title="モチベーション別" groups={mot} emojis={motEmojis} color={SKY} />
      )}
      {insight && (
        <div className="rounded-xl bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-300">
          {insight}
        </div>
      )}
    </div>
  );
}

function PerfBars({
  title,
  groups,
  emojis,
  color,
}: {
  title: string;
  groups: { level: number; avgPct: number; n: number }[];
  emojis: string[];
  color: string;
}) {
  const data = groups.map((g) => ({
    label: emojis[g.level - 1],
    pct: g.avgPct,
    n: g.n,
  }));
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-gray-500">{title}</div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 16, right: 8, left: -24, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 16 }} />
          <YAxis domain={[0, 110]} tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(v) => [`${v}%`, '達成率']}
            labelFormatter={(_l, payload) =>
              payload?.[0] ? `n=${(payload[0].payload as { n: number }).n}` : ''
            }
          />
          <Bar dataKey="pct" fill={color} radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 10 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
