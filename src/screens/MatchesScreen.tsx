import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MATCHES_URL } from '../config';
import { UpdatedAgo } from '../components/UpdatedAgo';
import { FavoriteButton } from '../components/FavoriteButton';
import { useFavorites } from '../hooks/useFavorites';

type Team = {
  id: string;
  name: string;
  city: string;
};

type Score = { home: number; away: number } | null;

type MatchStatus = 'finished' | 'live' | 'scheduled' | 'postponed';

type Match = {
  id: string;
  startsAt: string | null;
  status: MatchStatus;
  minute?: number;
  home: Team;
  away: Team;
  score: Score;
};

type MatchesResponse = {
  round: number;
  matches: Match[];
};

type Filter = 'all' | 'upcoming' | 'finished';
type Theme = 'light' | 'dark';

const STATUS_LABEL: Record<MatchStatus, string> = {
  finished: 'Завершён',
  live: 'В эфире',
  scheduled: 'Запланирован',
  postponed: 'Перенесён',
};

const STATUS_COLOR: Record<MatchStatus, string> = {
  finished: '#22c55e',
  live: '#ef3124',
  scheduled: '#3b82f6',
  postponed: '#94a3b8',
};

const STATUS_BG: Record<MatchStatus, string> = {
  finished: '#ecfdf5',
  live: '#fef2f2',
  scheduled: '#eff6ff',
  postponed: '#f3f4f6',
};

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'upcoming', label: 'Предстоящие' },
  { value: 'finished', label: 'Завершённые' },
];

function formatStartsAt(startsAt: string | null): string {
  if (!startsAt) {
    return 'Время не назначено';
  }
  return new Date(startsAt).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const THEMES: Record<Theme, { name: string; emoji: string }> = {
  light: { name: 'Светлая', emoji: '\u2600' },
  dark: { name: 'Тёмная', emoji: '\u263E' },
};

const LIGHT_COLORS = {
  background: '#f9fafb',
  surface: '#ffffff',
  text: '#111823',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e7eb',
  chipBg: '#ffffff',
  chipBorder: '#e5e7eb',
  cardShadow: '#000000',
} as const;

const DARK_COLORS = {
  background: '#0f172a',
  surface: '#1e293b',
  text: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  border: '#334155',
  chipBg: '#1e293b',
  chipBorder: '#334155',
  cardShadow: '#000000',
} as const;

function createStyles(isDark: boolean) {
  const c = isDark ? DARK_COLORS : LIGHT_COLORS;
  const scoreColor = isDark ? '#fbbf24' : '#ef3124';

  return StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
      backgroundColor: c.background,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: c.text,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    themeButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: c.chipBg,
      borderWidth: 1,
      borderColor: c.chipBorder,
    },
    themeButtonText: {
      fontSize: 14,
      color: c.text,
    },
    refreshButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: c.chipBg,
      borderWidth: 1,
      borderColor: c.chipBorder,
      shadowColor: c.cardShadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    refreshButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: scoreColor,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
      flexWrap: 'wrap',
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.chipBorder,
      backgroundColor: c.chipBg,
    },
    chipActive: {
      backgroundColor: scoreColor,
      borderColor: scoreColor,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textSecondary,
    },
    chipTextActive: {
      color: '#ffffff',
    },
    listContent: {
      paddingBottom: 24,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
      marginBottom: 14,
      shadowColor: c.cardShadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },
    favoriteRow: {
      alignSelf: 'flex-end',
      marginBottom: 8,
    },
    teams: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    team: {
      alignItems: 'center',
    },
    teamName: {
      fontSize: 17,
      fontWeight: '700',
      color: c.text,
    },
    teamCity: {
      fontSize: 11,
      color: c.textMuted,
      marginTop: 2,
    },
    score: {
      fontSize: 20,
      fontWeight: '800',
      color: c.text,
      minWidth: 64,
      textAlign: 'center',
    },
    scoreWithValue: {
      color: scoreColor,
    },
    bottom: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    time: {
      fontSize: 13,
      color: c.textSecondary,
    },
    status: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: 6,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '700',
    },
    loader: {
      alignItems: 'center',
      marginTop: 60,
    },
    loaderText: {
      marginTop: 10,
      fontSize: 15,
      color: c.textSecondary,
    },
    error: {
      alignItems: 'center',
      marginTop: 60,
      paddingHorizontal: 24,
    },
    errorText: {
      fontSize: 15,
      color: scoreColor,
      textAlign: 'center',
      marginBottom: 12,
    },
    retryButton: {
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: scoreColor,
      shadowColor: c.cardShadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 2,
      elevation: 3,
    },
    retryText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    empty: {
      alignItems: 'center',
      marginTop: 60,
      paddingHorizontal: 24,
    },
    emptyText: {
      fontSize: 15,
      color: c.textSecondary,
      textAlign: 'center',
    },
  });
}

function MatchCard({
  match,
  isFavorite,
  onToggle,
  isDark,
}: {
  match: Match;
  isFavorite: boolean;
  onToggle: () => void;
  isDark: boolean;
}) {
  const score = match.score
    ? `${match.score.home} : ${match.score.away}`
    : '—';
  const statusColor = STATUS_COLOR[match.status];
  const statusBg = isDark
    ? STATUS_BG[match.status]
    : STATUS_BG[match.status];
  const styles = createStyles(isDark);

  return (
    <View style={styles.card}>
      <View style={styles.favoriteRow}>
        <FavoriteButton active={isFavorite} onPress={onToggle} />
      </View>
      <View style={styles.teams}>
        <View style={styles.team}>
          <Text style={styles.teamName}>{match.home.name}</Text>
          <Text style={styles.teamCity}>{match.home.city}</Text>
        </View>
        <Text style={[styles.score, match.score && styles.scoreWithValue]}>
          {score}
        </Text>
        <View style={styles.team}>
          <Text style={styles.teamName}>{match.away.name}</Text>
          <Text style={styles.teamCity}>{match.away.city}</Text>
        </View>
      </View>
      <View style={styles.bottom}>
        <Text style={styles.time}>{formatStartsAt(match.startsAt)}</Text>
        <View style={[styles.status, { backgroundColor: statusBg }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {STATUS_LABEL[match.status]}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function MatchesScreen() {
  const { isFavorite, toggle } = useFavorites();
  const [theme, setTheme] = useState<Theme>('light');
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const styles = createStyles(theme === 'dark');

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(MATCHES_URL);
      if (!response.ok) {
        throw new Error(`Ошибка сервера (${response.status})`);
      }
      const data = (await response.json()) as MatchesResponse;
      setMatches(data.matches ?? []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить матчи');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadMatches();
  }, [loadMatches]);

  const filteredMatches = useMemo(() => {
    if (filter === 'all') return matches;
    if (filter === 'upcoming') {
      return matches.filter(match => match.status === 'scheduled');
    }
    return matches.filter(match => match.status === 'finished');
  }, [matches, filter]);

  const isDark = theme === 'dark';

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={STATUS_COLOR.live} />
        <Text style={styles.loaderText}>Загрузка матчей…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.error}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={loadMatches}>
          <Text style={styles.retryText}>Повторить</Text>
        </Pressable>
      </View>
    );
  }

  const activeFilterLabel = FILTERS.find(f => f.value === filter)?.label;
  const currentTheme = THEMES[theme];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Матчи тура</Text>
        <View style={styles.toggleRow}>
          <Pressable
            style={styles.themeButton}
            onPress={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            <Text style={styles.themeButtonText}>
              {currentTheme.emoji} {currentTheme.name}
            </Text>
          </Pressable>
          <Pressable
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            <Text style={styles.refreshButtonText}>
              {refreshing ? 'Обновление…' : 'Обновить'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map(item => (
          <Pressable
            key={item.value}
            style={[styles.chip, filter === item.value && styles.chipActive]}
            onPress={() => setFilter(item.value)}
            disabled={refreshing}
          >
            <Text
              style={[styles.chipText, filter === item.value && styles.chipTextActive]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {lastUpdated && <UpdatedAgo since={lastUpdated} />}

      <FlatList
        data={filteredMatches}
        keyExtractor={match => match.id}
        renderItem={({ item }) => (
          <MatchCard
            match={item}
            isFavorite={isFavorite(item.id)}
            onToggle={() => toggle(item.id)}
            isDark={isDark}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.listContent}
      />

      {filteredMatches.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {filter === 'all'
              ? 'Матчей тура нет'
              : `По фильтру «${activeFilterLabel}» матчей не найдено`}
          </Text>
        </View>
      )}
    </View>
  );
}