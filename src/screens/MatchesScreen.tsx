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

const STATUS_LABEL: Record<MatchStatus, string> = {
  finished: 'Завершён',
  live: 'В прямом эфире',
  scheduled: 'Предстоящий',
  postponed: 'Отложен',
};

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'upcoming', label: 'Предстоящие' },
  { value: 'finished', label: 'Завершённые' },
];

// startsAt приходит в UTC; new Date + toLocaleString автоматически
// переводит время в часовой пояс устройства.
function formatStartsAt(startsAt: string | null): string {
  if (!startsAt) {
    return 'Время не назначено';
  }
  return new Date(startsAt).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function MatchCard({
  match,
  isFavorite,
  onToggle,
}: {
  match: Match;
  isFavorite: boolean;
  onToggle: () => void;
}) {
  const score = match.score
    ? `${match.score.home} : ${match.score.away}`
    : '—';

  return (
    <View style={styles.card}>
      <View style={styles.teams}>
        <Text style={styles.team}>{match.home.name}</Text>
        <Text style={styles.score}>{score}</Text>
        <Text style={styles.team}>{match.away.name}</Text>
        <FavoriteButton active={isFavorite} onPress={onToggle} />
      </View>
      <View style={styles.bottom}>
        <Text style={styles.time}>{formatStartsAt(match.startsAt)}</Text>
        <Text style={[styles.status, match.status === 'live' && styles.statusLive]}>
          {STATUS_LABEL[match.status]}
        </Text>
      </View>
    </View>
  );
}

export function MatchesScreen() {
  const { isFavorite, toggle } = useFavorites();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#ef3124" />
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

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Матчи тура</Text>
        <Pressable style={styles.refreshButton} onPress={handleRefresh} disabled={refreshing}>
          <Text style={styles.refreshButtonText}>{refreshing ? 'Обновление…' : 'Обновить'}</Text>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map(item => (
          <Pressable
            key={item.value}
            style={[styles.chip, filter === item.value && styles.chipActive]}
            onPress={() => setFilter(item.value)}
            disabled={refreshing}
          >
            <Text style={[styles.chipText, filter === item.value && styles.chipTextActive]}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
    backgroundColor: '#fff',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f2f2f2',
  },
  refreshButtonText: {
    fontSize: 13,
    color: '#111823',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  chipActive: {
    backgroundColor: '#ef3124',
    borderColor: '#ef3124',
  },
  chipText: {
    fontSize: 13,
    color: '#374151',
  },
  chipTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
  },
  teams: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  team: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111823',
  },
  score: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111823',
  },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  time: {
    fontSize: 13,
    color: '#6b7280',
  },
  status: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  statusLive: {
    color: '#ef3124',
  },
  loader: {
    alignItems: 'center',
    marginTop: 40,
  },
  loaderText: {
    marginTop: 10,
    fontSize: 15,
    color: '#6b7280',
  },
  error: {
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 15,
    color: '#ef3124',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ef3124',
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
