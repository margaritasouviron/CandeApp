import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import type { DurationBlock, JournalLogItem } from '../lib/careEvents';
import {
  EVENT_COLORS,
  EVENT_LABELS,
  EVENT_SHADE_COLORS,
  isCalendarShadedOnlyLogType,
  isInstantEventType,
  type EventType,
} from '../lib/eventTypes';
import type { UpcomingDose } from '../lib/medicationSchedules';
import { useAppColors } from '../lib/ThemeModeProvider';
import { fonts } from '../lib/typography';
import type { AppColors } from '../lib/theme';

const HOUR_HEIGHT = 48;
const TIME_GUTTER = 48;
const GRID_HEIGHT = HOUR_HEIGHT * 24;
const COL_GAP = 2;
/** Ventana mínima para columnas de eventos no puntuales. */
const INSTANT_EVENT_MS = 5 * 60 * 1000;
const INSTANT_LINE_THICKNESS = 3;
const INSTANT_BOX_HEIGHT = 36;
const INSTANT_BOX_WIDTH_PCT = 42;
const INSTANT_BOX_GAP = 4;

type Props = {
  dateStr: string;
  logs: JournalLogItem[];
  durationBlocks: DurationBlock[];
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

type InstantMarker = {
  key: string;
  kind: 'log' | 'scheduled';
  top: number;
  boxTop: number;
  startIso: string;
  log?: JournalLogItem;
  dose?: UpcomingDose;
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

function formatEventClock(iso: string) {
  return new Date(iso).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
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

function msToGridTop(dateStr: string, iso: string) {
  const dayStart = dayStartMs(dateStr);
  const t = new Date(iso).getTime();
  return ((t - dayStart) / 3600000) * HOUR_HEIGHT;
}

function layoutInstantMarkers(markers: Omit<InstantMarker, 'boxTop'>[]): InstantMarker[] {
  const sorted = [...markers].sort((a, b) => a.top - b.top || a.key.localeCompare(b.key));
  let stackBottom = -Infinity;
  return sorted.map((m) => {
    let boxTop = m.top - INSTANT_BOX_HEIGHT / 2;
    if (boxTop < stackBottom + INSTANT_BOX_GAP) {
      boxTop = stackBottom + INSTANT_BOX_GAP;
    }
    stackBottom = boxTop + INSTANT_BOX_HEIGHT;
    return { ...m, boxTop };
  });
}

function buildInstantMarkers(
  dateStr: string,
  logs: JournalLogItem[],
  scheduled: UpcomingDose[]
): InstantMarker[] {
  const raw: Omit<InstantMarker, 'boxTop'>[] = [];

  for (const log of logs) {
    if (log.tipo === 'comida') {
      if (log.mealHasInterval) continue;
    } else if (!isInstantEventType(log.tipo)) {
      continue;
    }
    if (!sameCalendarDay(dateStr, log.registrado_en)) continue;
    raw.push({
      key: log.id,
      kind: 'log',
      top: msToGridTop(dateStr, log.registrado_en),
      startIso: log.registrado_en,
      log,
    });
  }

  for (const dose of scheduled) {
    if (!sameCalendarDay(dateStr, dose.programadoPara)) continue;
    raw.push({
      key: `sched-${dose.id}`,
      kind: 'scheduled',
      top: msToGridTop(dateStr, dose.programadoPara),
      startIso: dose.programadoPara,
      dose,
    });
  }

  return layoutInstantMarkers(raw);
}

function buildTimedEntries(dateStr: string, logs: JournalLogItem[]): TimedEntry[] {
  const items: TimedEntry[] = [];

  for (const log of logs.filter((l) => !isCalendarShadedOnlyLogType(l.tipo) && !isInstantEventType(l.tipo))) {
    const startIso = log.registrado_en;
    const endIso = new Date(new Date(startIso).getTime() + INSTANT_EVENT_MS).toISOString();
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

function createGridStyles(colors: AppColors) {
  return StyleSheet.create({
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
    instantLayer: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      zIndex: 4,
    },
    instantLine: {
      position: 'absolute',
      left: 0,
      height: INSTANT_LINE_THICKNESS,
      borderRadius: 2,
    },
    instantBox: {
      position: 'absolute',
      right: 0,
      minHeight: INSTANT_BOX_HEIGHT,
      borderRadius: 6,
      paddingVertical: 4,
      paddingHorizontal: 6,
      justifyContent: 'center',
      borderLeftWidth: 3,
      overflow: 'hidden',
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
    },
    instantBoxSolid: {
      borderLeftWidth: 0,
    },
    instantScheduledHint: {
      fontFamily: fonts.body,
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 1,
    },
    durationBlock: {
      position: 'absolute',
      left: 0,
      right: 0,
      borderLeftWidth: 4,
      zIndex: 1,
      paddingHorizontal: 6,
      paddingVertical: 4,
      justifyContent: 'flex-start',
      borderRadius: 4,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
    },
    durationLabel: { fontFamily: fonts.bodySemi, fontSize: 11, lineHeight: 14 },
    scheduledTitle: { fontFamily: fonts.title, fontSize: 12, color: colors.greenDark },
    scheduledTimeRight: {
      fontFamily: fonts.bodySemi,
      fontSize: 11,
      color: colors.greenDark,
      flexShrink: 0,
      textAlign: 'right',
      minWidth: 42,
      paddingLeft: 6,
    },
    eventBlock: {
      position: 'absolute',
      borderRadius: 5,
      paddingVertical: 4,
      paddingHorizontal: 4,
      justifyContent: 'center',
      zIndex: 2,
      overflow: 'hidden',
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
    },
    eventRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
      flex: 1,
    },
    eventBody: { flex: 1, minWidth: 0 },
    eventTitle: { fontFamily: fonts.title, fontSize: 13, color: colors.fabText, lineHeight: 16 },
    eventTitleNarrow: { fontSize: 11, lineHeight: 14 },
    eventDetail: { fontFamily: fonts.body, fontSize: 11, color: 'rgba(255,255,255,0.92)', marginTop: 1, lineHeight: 13 },
    eventDetailNarrow: { fontSize: 10, lineHeight: 12 },
    eventTimeRight: {
      fontFamily: fonts.bodySemi,
      fontSize: 11,
      color: 'rgba(255,255,255,0.95)',
      flexShrink: 0,
      textAlign: 'right',
      minWidth: 42,
      paddingLeft: 6,
    },
    timeRightTight: { fontSize: 10, minWidth: 36 },
    textTight: { fontSize: 10, lineHeight: 12 },
  });
}

export function DayTimeGrid({ dateStr, logs, durationBlocks, scheduled, onLogPress }: Props) {
  const colors = useAppColors();
  const styles = useMemo(() => createGridStyles(colors), [colors]);
  const dayScheduled = scheduled.filter((d) => sameCalendarDay(dateStr, d.programadoPara));

  const placed = useMemo(() => {
    const entries = buildTimedEntries(dateStr, logs);
    return layoutTimedEntries(dateStr, entries);
  }, [dateStr, logs, dayScheduled]);

  const instantMarkers = useMemo(
    () => buildInstantMarkers(dateStr, logs, dayScheduled),
    [dateStr, logs, dayScheduled]
  );

  return (
    <View style={styles.wrap}>
      {Array.from({ length: 25 }, (_, i) => (
        <View key={`line-${i}`} style={[styles.hourLine, { top: i * HOUR_HEIGHT }]}>
          {i < 24 ? <Text style={styles.hourLabel}>{formatHourLabel(i)}</Text> : null}
        </View>
      ))}

      <View style={[styles.gridArea, { height: GRID_HEIGHT }]}>
        {durationBlocks.map((block, idx) => {
          const layout = toTimedLayout(dateStr, block.inicio, block.fin);
          if (!layout) return null;
          const accent = EVENT_COLORS[block.tipo] ?? colors.greenDark;
          const fill = EVENT_SHADE_COLORS[block.tipo] ?? colors.sleepShade;
          const linkedLog = logs.find((l) => l.id === block.careLogId);
          const label =
            block.tipo === 'terapia' && block.subtipo
              ? EVENT_LABELS.terapia
              : linkedLog?.title || EVENT_LABELS[block.tipo] || block.tipo;
          return (
            <Pressable
              key={`dur-${block.careLogId}-${idx}`}
              style={[
                styles.durationBlock,
                {
                  top: layout.top,
                  height: layout.height,
                  backgroundColor: fill,
                  borderLeftColor: accent,
                },
              ]}
              onPress={() => onLogPress?.(block.careLogId)}
              disabled={!onLogPress}
            >
              <Text style={[styles.durationLabel, { color: accent }]} numberOfLines={2}>
                {label}
              </Text>
            </Pressable>
          );
        })}

        {instantMarkers.map((marker) => {
          const lineTop = marker.top - INSTANT_LINE_THICKNESS / 2;
          const boxWidth = `${INSTANT_BOX_WIDTH_PCT}%` as `${number}%`;
          const lineRight = `${INSTANT_BOX_WIDTH_PCT}%` as `${number}%`;

          if (marker.kind === 'scheduled' && marker.dose) {
            const accent = colors.greenDark;
            return (
              <View key={marker.key} pointerEvents="box-none" style={styles.instantLayer}>
                <View
                  style={[
                    styles.instantLine,
                    { top: lineTop, right: lineRight, backgroundColor: accent },
                  ]}
                />
                <View
                  style={[
                    styles.instantBox,
                    {
                      top: marker.boxTop,
                      width: boxWidth,
                      backgroundColor: colors.upcomingFill,
                      borderLeftColor: accent,
                    },
                  ]}
                >
                  <View style={styles.eventRow}>
                    <View style={styles.eventBody}>
                      <Text style={styles.scheduledTitle} numberOfLines={1}>
                        {marker.dose.nombre}
                      </Text>
                      <Text style={styles.instantScheduledHint} numberOfLines={1}>
                        Programada
                      </Text>
                    </View>
                    <Text style={styles.scheduledTimeRight} numberOfLines={1}>
                      {formatEventClock(marker.startIso)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }

          const log = marker.log!;
          const accent = EVENT_COLORS[log.tipo as EventType] ?? colors.greenDark;
          return (
            <View key={marker.key} pointerEvents="box-none" style={styles.instantLayer}>
              <View
                style={[styles.instantLine, { top: lineTop, right: lineRight, backgroundColor: accent }]}
              />
              <Pressable
                style={[
                  styles.instantBox,
                  styles.instantBoxSolid,
                  {
                    top: marker.boxTop,
                    width: boxWidth,
                    backgroundColor: accent,
                  },
                ]}
                onPress={() => onLogPress?.(log.id)}
                disabled={!onLogPress}
              >
                <View style={styles.eventRow}>
                  <View style={styles.eventBody}>
                    <Text style={styles.eventTitle} numberOfLines={1}>
                      {log.title || EVENT_LABELS[log.tipo as EventType]}
                    </Text>
                    {log.detail ? (
                      <Text style={styles.eventDetail} numberOfLines={2}>
                        {log.detail}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.eventTimeRight} numberOfLines={1}>
                    {formatEventClock(marker.startIso)}
                  </Text>
                </View>
              </Pressable>
            </View>
          );
        })}

        {placed.map((ev) => {
          const geom = columnGeometry(ev.col, ev.colCount);
          const narrow = ev.colCount > 1;
          const tight = ev.colCount >= 3;
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
              <View style={styles.eventRow}>
                <View style={styles.eventBody}>
                  <Text
                    style={[styles.eventTitle, narrow && styles.eventTitleNarrow, tight && styles.textTight]}
                    numberOfLines={tight ? 2 : 1}
                  >
                    {log.title || EVENT_LABELS[log.tipo as EventType]}
                  </Text>
                  {log.detail ? (
                    <Text
                      style={[styles.eventDetail, narrow && styles.eventDetailNarrow, tight && styles.textTight]}
                      numberOfLines={tight ? 1 : 2}
                    >
                      {log.detail}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.eventTimeRight, tight && styles.timeRightTight]} numberOfLines={1}>
                  {formatEventClock(ev.startIso)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const dayTimeGridHeight = GRID_HEIGHT;
