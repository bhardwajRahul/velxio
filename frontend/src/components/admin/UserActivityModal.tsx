import { useEffect, useMemo, useState } from 'react';
import {
  adminGetUserActivity,
  type DailyProjectActivity,
  type DailyTotals,
  type UserDailyActivityResponse,
} from '../../services/metricsService';

interface Props {
  userId: string;
  username: string;
  onClose: () => void;
}

const RANGE_OPTIONS = [7, 30, 90, 365];

export function UserActivityModal({ userId, username, onClose }: Props) {
  const [data, setData] = useState<UserDailyActivityResponse | null>(null);
  const [rangeDays, setRangeDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    adminGetUserActivity(userId, rangeDays)
      .then(setData)
      .catch((e: any) => setError(e?.response?.data?.detail || 'Failed to load activity.'))
      .finally(() => setLoading(false));
  }, [userId, rangeDays]);

  // Group entries by date for the per-day expandable view
  const grouped = useMemo(() => {
    const map = new Map<string, DailyProjectActivity[]>();
    for (const e of data?.entries ?? []) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [data]);

  const totalsByDate = useMemo(() => {
    const map = new Map<string, DailyTotals>();
    for (const t of data?.daily_totals ?? []) map.set(t.date, t);
    return map;
  }, [data]);

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <div>
            <h2 style={s.title}>Daily activity — {username}</h2>
            <p style={s.subtitle}>
              Per-day, per-project compile and run counts for this user.
            </p>
          </div>
          <button style={s.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        <div style={s.controls}>
          <span style={s.muted}>Range:</span>
          {RANGE_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setRangeDays(d)}
              style={d === rangeDays ? s.rangeBtnActive : s.rangeBtn}
            >
              {d === 365 ? '1y' : `${d}d`}
            </button>
          ))}
        </div>

        {loading && <p style={s.muted}>Loading…</p>}
        {error && <div style={s.error}>{error}</div>}

        {!loading && !error && data && grouped.length === 0 && (
          <p style={s.muted}>No activity in the selected range.</p>
        )}

        {!loading && !error && grouped.length > 0 && (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Date</th>
                  <th style={s.th}>Project</th>
                  <th style={s.thNum}>Compiles</th>
                  <th style={s.thNum}>Errors</th>
                  <th style={s.thNum}>Runs</th>
                  <th style={s.thNum}>Saves</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(([date, entries]) => {
                  const totals = totalsByDate.get(date);
                  return (
                    <>
                      {/* Day header row */}
                      <tr key={date} style={s.dayHeaderRow}>
                        <td style={s.dayHeaderCell}>{date}</td>
                        <td style={s.dayHeaderCell}>
                          <span style={s.muted}>
                            {totals?.distinct_projects ?? entries.length} project
                            {(totals?.distinct_projects ?? entries.length) === 1 ? '' : 's'}
                          </span>
                        </td>
                        <td style={s.dayHeaderTotal}>{totals?.compiles ?? 0}</td>
                        <td style={s.dayHeaderTotal}>{totals?.compile_errors ?? 0}</td>
                        <td style={s.dayHeaderTotal}>{totals?.runs ?? 0}</td>
                        <td style={s.dayHeaderTotal}>{totals?.saves ?? 0}</td>
                      </tr>
                      {/* Per-project rows for that day */}
                      {entries.map((e, i) => (
                        <tr key={`${date}-${e.project_id ?? 'none'}-${i}`} style={s.tr}>
                          <td style={s.tdIndent}>↳</td>
                          <td style={s.td}>
                            {e.project_name ?? (
                              <span style={s.mutedItalic}>
                                {e.project_id ? '(deleted project)' : '(no project)'}
                              </span>
                            )}
                          </td>
                          <td style={s.tdNum}>{e.compiles}</td>
                          <td style={s.tdNum}>
                            {e.compile_errors > 0 ? (
                              <span style={s.errText}>{e.compile_errors}</span>
                            ) : (
                              0
                            )}
                          </td>
                          <td style={s.tdNum}>{e.runs}</td>
                          <td style={s.tdNum}>{e.saves}</td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '2rem',
  },
  box: {
    background: '#252526',
    border: '1px solid #3c3c3c',
    borderRadius: 8,
    padding: '1.5rem',
    width: '90%',
    maxWidth: 880,
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    overflow: 'hidden',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  title: { color: '#ccc', margin: 0, fontSize: 18, fontWeight: 600 },
  subtitle: { color: '#777', fontSize: 12, margin: '4px 0 0 0' },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#9d9d9d',
    fontSize: 24,
    cursor: 'pointer',
    lineHeight: 1,
    padding: '0 6px',
  },
  controls: { display: 'flex', alignItems: 'center', gap: 8 },
  rangeBtn: {
    background: 'transparent',
    border: '1px solid #444',
    borderRadius: 4,
    color: '#9d9d9d',
    padding: '4px 10px',
    fontSize: 12,
    cursor: 'pointer',
  },
  rangeBtnActive: {
    background: '#0e639c',
    border: '1px solid #0e639c',
    borderRadius: 4,
    color: '#fff',
    padding: '4px 10px',
    fontSize: 12,
    cursor: 'pointer',
  },
  muted: { color: '#777', fontSize: 13 },
  mutedItalic: { color: '#777', fontStyle: 'italic', fontSize: 13 },
  error: {
    background: '#5a1d1d',
    border: '1px solid #f44747',
    borderRadius: 4,
    color: '#f44747',
    padding: '8px 12px',
    fontSize: 13,
  },
  tableWrap: { overflowY: 'auto', flex: 1 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left',
    color: '#9d9d9d',
    padding: '8px 10px',
    borderBottom: '1px solid #3c3c3c',
    fontWeight: 500,
    fontSize: 12,
    position: 'sticky',
    top: 0,
    background: '#252526',
  },
  thNum: {
    textAlign: 'right',
    color: '#9d9d9d',
    padding: '8px 10px',
    borderBottom: '1px solid #3c3c3c',
    fontWeight: 500,
    fontSize: 12,
    position: 'sticky',
    top: 0,
    background: '#252526',
  },
  tr: { borderBottom: '1px solid #2d2d2d' },
  td: { color: '#ccc', padding: '6px 10px' },
  tdNum: { color: '#ccc', padding: '6px 10px', textAlign: 'right' },
  tdIndent: { color: '#555', padding: '6px 10px', width: 24 },
  dayHeaderRow: {
    background: '#1f1f1f',
    borderTop: '2px solid #3c3c3c',
    borderBottom: '1px solid #2d2d2d',
  },
  dayHeaderCell: { color: '#fff', padding: '8px 10px', fontWeight: 600 },
  dayHeaderTotal: {
    color: '#fff',
    padding: '8px 10px',
    fontWeight: 600,
    textAlign: 'right',
  },
  errText: { color: '#f48771' },
};
