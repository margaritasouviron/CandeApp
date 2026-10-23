import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import type { JournalLogItem, SleepBlock } from '../lib/careEvents';
import { EVENT_COLORS, EVENT_LABELS, type EventType } from '../lib/eventTypes';
import type { UpcomingDose } from '../lib/medicationSchedules';
import { colors } from '../lib/theme';
import { fonts } from '../lib/typography';

const HOUR_HEIGHT = 48;
const TIME_GUTTER = 48;
const GRID_HEIGHT = HOUR_HEIGHT * 24;
const COL_GAP = 2;

type Props = {
  dateStr: string;
  logs: JournalLogItem[];
  sleepBlocks: SleepBlock[];
  scheduled: UpcomingDose[];
  onLogPress?: (careLogId: string) => void;
};

type TimedEntry = {
  key: string;
  kind: 'log' | 'scheduled';
  start: number;
  end: number;
  log?: JournalLogItem;
  dose?: UpcomingDose;
  startIso: string;
  endIso: string;
};

type PlacedEntry = TimedEntry & {
  top: number;
  height: number;
  col: number;
  colCount: number;
};

function formatHourLabel(hour: number) {
  const d = new Date(2000, 0, 1, hour, 0);
  return d.toLocaleTimeString('es-ES', { hour: 'numeric', hour12: true }).replace(/\s/g, ' ');
}

function sameCalendarDay(dateStr: string, iso: string) {
  const d = new Date(iso);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return key === dateStr;
}

function dayStartMs(dateStr: string) {
  const [y, mo, da] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, da, 0, 0, 0).getTime();
}

function clampDayRange(dateStr: string, startIso: string, endIso: string) {
  const dayStart = dayStartMs(dateStr);
  const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
  const a = Math.max(dayStart, new Date(startIso).getTime());
  const b = Math.min(dayEnd, new Date(endIso).getTime());
  return { a, b };
}

function toTimedLayout(dateStr: string, startIso: string, endIso: string) {
  const { a, b } = clampDayRange(dateStr, startIso, endIso);
  if (b <= a) return null;
  const start = dayStartMs(dateStr);
  const top = ((a - start) / (60 * 60 * 1000)) * HOUR_HEIGHT;
  const height = Math.max(26, ((b - a) / (60 * 60 * 1000)) * HOUR_HEIGHT);
  return { top, height, start: a, end: b };
}

function formatRange(startIso: string, endIso: string) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${fmt(startIso)} – ${fmt(endIso)}`;
}

/** Reparte eventos solapados en columnas (estilo agenda). */
function layoutTimedEntries(dateStr: string, entries: TimedEntry[]): PlacedEntry[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) => a.start - b.start || b.end - a.end);
  const columnEnds: number[] = [];
  const withCol: (TimedEntry & { col: number })[] = [];

  for (const ev of sorted) {
    let col = columnEnds.findIndex((end) => end <= ev.start);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(ev.end);
    } else {
      columnEnds[col] = ev.end;
    }
    withCol.push({ ...ev, col });
  }

  const dayStart = dayStartMs(dateStr);
  return withCol.map((ev) => {
    const overlaps = withCol.filter((o) => o.start < ev.end && o.end > ev.start);
    const colCount = Math.max(...overlaps.map((o) => o.col), 0) + 1;
    const top = ((ev.start - dayStart) / 3600000) * HOUR_HEIGHT;
    const height = Math.max(26, ((ev.end - ev.start) / 3600000) * HOUR_HEIGHT);
    return { ...ev, colCount, top, height };
  });
}

function buildTimedEntries(
  dateStr: string,
  logs: JournalLogItem[],
  scheduled: UpcomingDose[]
): TimedEntry[] {
  const items: TimedEntry[] = [];

  for (const log of logs.filter((l) => l.tipo !== 'sueno')) {
    const startIso = log.registrado_en;
    const endIso = new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();
    const range = clampDayRange(dateStr, startIso, endIso);
    if (range.b <= range.a) continue;
    items.push({
      key: log.id,
      kind: 'log',
      start: range.a,
      end: range.b,
      log,
      startIso,
      endIso,
    });
  }

  for (const dose of scheduled) {
    const startIso = dose.programadoPara;
    const endIso = new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();
    const range = clampDayRange(dateStr, startIso, endIso);
    if (range.b <= range.a) continue;
    items.push({
      key: `sched-${dose.id}`,
      kind: 'scheduled',
      start: range.a,
      end: range.b,
      dose,
      startIso,
      endIso,
    });
  }

  return items;
}

function columnGeometry(col: number, colCount: number) {
  const widthPct = 100 / colCount;
  const leftPct = col * widthPct;
  return {
    left: `${leftPct}%` as `${number}%`,
    width: `${widthPct}%` as `${number}%`,
    paddingRight: col < colCount - 1 ? COL_GAP : 0,
    paddingLeft: col > 0 ? COL_GAP / 2 : COL_GAP,
  };
}

export function DayTimeGrid({ dateStr, logs, sleepBlocks, scheduled, onLogPress }: Props) {
  const dayScheduled = scheduled.filter((d) => sameCalendarDay(dateStr, d.programadoPara));

  const placed = useMemo(() => {
    const entries = buildTimedEntries(dateStr, logs, dayScheduled);
    return layoutTimedEntries(dateStr, entries);
  }, [dateStr, logs, dayScheduled]);

  return (
    <View style={styles.wrap}>
      {Array.from({ length: 25 }, (_, i) => (
        <View key={`line-${i}`} style={[styles.hourLine, { top: i * HOUR_HEIGHT }]}>
          {i < 24 ? <Text style={styles.hourLabel}>{formatHourLabel(i)}</Text> : null}
        </View>
      ))}

      <View style={[styles.gridArea, { height: GRID_HEIGHT }]}>
        {sleepBlocks.map((block, idx) => {
          const layout = toTimedLayout(dateStr, block.inicio, block.fin);
          if (!layout) return null;
          return (
            <Pressable
              key={`sleep-${idx}`}
              style={[styles.sleepBlock, { top: layout.top, height: layout.height }]}
              onPress={() => block.careLogId && onLogPress?.(block.careLogId)}
              disabled={!onLogPress || !block.careLogId}
            />
          );
        })}

        {placed.map((ev) => {
          const geom = columnGeometry(ev.col, ev.colCount);
          const narrow = ev.colCount > 1;
          const tight = ev.colCount >= 3;

          if (ev.kind === 'scheduled' && ev.dose) {
            return (
              <View
                key={ev.key}
                style={[
                  styles.scheduledBlock,
                  {
                    top: ev.top,
                    height: ev.height,
                    left: geom.left,
                    width: geom.width,
                    paddingLeft: geom.paddingLeft,
                    paddingRight: geom.paddingRight,
                  },
                ]}
              >
                <Text style={[styles.scheduledTitle, tight && styles.textTight]} numberOfLines={narrow ? 3 : 2}>
                  {ev.dose.nombre}
                </Text>
                {!tight && (
                  <Text style={styles.scheduledTime} numberOfLines={1}>
                    {formatRange(ev.startIso, ev.endIso)}
                  </Text>
                )}
              </View>
            );
          }

          const log = ev.log!;
          const accent = EVENT_COLORS[log.tipo as EventType] ?? colors.greenDark;
          return (
            <Pressable
              key={ev.key}
              style={[
                styles.eventBlock,
                {
                  top: ev.top,
                  height: ev.height,
                  left: geom.left,
                  width: geom.width,
                  paddingLeft: 4 + geom.paddingLeft,
                  paddingRight: 4 + geom.paddingRight,
                  backgroundColor: accent,
                },
              ]}
              onPress={() => onLogPress?.(log.id)}
              disabled={!onLogPress}
            >
              <Text
                style={[styles.eventTitle, narrow && styles.eventTitleNarrow, tight && styles.textTight]}
                numberOfLines={tight ? 4 : 3}
              >
                {log.title || EVENT_LABELS[log.tipo as EventType]}
              </Text>
              {log.detail && !tight && (
                <Text style={[styles.eventDetail, narrow && styles.eventDetailNarrow]} numberOfLines={narrow ? 2 : 3}>
                  {log.detail}
                </Text>
              )}
              {!narrow && (
                <Text style={styles.eventTime} numberOfLines={1}>
                  {formatRange(ev.startIso, ev.endIso)}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const dayTimeGridHeight = GRID_HEIGHT;

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    height: GRID_HEIGHT,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  hourLine: {
    position: 'absolute',
    left: TIME_GUTTER,
    right: 0,
    height: 1,
    backgroundColor: colors.borderSoft,
  },
  hourLabel: {
    position: 'absolute',
    left: -TIME_GUTTER + 4,
    top: -8,
    width: TIME_GUTTER - 8,
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
  },
  gridArea: {
    marginLeft: TIME_GUTTER,
    marginRight: 4,
    position: 'relative',
  },
  sleepBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.sleepShade,
    borderLeftWidth: 3,
    borderLeftColor: colors.greenDark,
    zIndex: 0,
  },
  scheduledBlock: {
    position: 'absolute',
    backgroundColor: colors.upcomingFill,
    borderLeftWidth: 3,
    borderLeftColor: colors.greenDark,
    borderRadius: 4,
    paddingVertical: 3,
    justifyContent: 'flex-start',
    zIndex: 1,
    overflow: 'hidden',
  },
  scheduledTitle: { fontFamily: fonts.title, fontSize: 12, color: colors.greenDark },
  scheduledTime: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 1 },
  eventBlock: {
    position: 'absolute',
    borderRadius: 5,
    paddingVertical: 4,
    justifyContent: 'flex-start',
    zIndex: 2,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
  },
  eventTitle: { fontFamily: fonts.title, fontSize: 13, color: colors.white, lineHeight: 16 },
  eventTitleNarrow: { fontSize: 11, lineHeight: 14 },
  eventDetail: { fontFamily: fonts.body, fontSize: 11, color: 'rgba(255,255,255,0.92)', marginTop: 2, lineHeight: 14 },
  eventDetailNarrow: { fontSize: 10, lineHeight: 12 },
  eventTime: { fontFamily: fonts.body, fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  textTight: { fontSize: 10, lineHeight: 12 },
});
