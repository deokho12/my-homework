import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { searchAddress } from '@/services/geocoding';
import type { GeocodeResult } from '@/types/domain';

interface AddressSearchInputProps {
  initialAddress?: string;
  onSelect: (result: GeocodeResult) => void;
}

const DEBOUNCE_MS = 300;

export function AddressSearchInput({ initialAddress, onSelect }: AddressSearchInputProps) {
  const [confirmedAddress, setConfirmedAddress] = useState(initialAddress ?? '');
  // No confirmed address yet (new hospital) → start straight in search mode.
  const [mode, setMode] = useState<'confirmed' | 'search'>(initialAddress ? 'confirmed' : 'search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (mode !== 'search' || query.trim().length === 0) {
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(() => {
      searchAddress(query.trim())
        .then((found) => {
          if (cancelled) return;
          setResults(found);
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
        })
        .finally(() => {
          if (cancelled) return;
          setLoading(false);
          setHasSearched(true);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, mode]);

  const handleSelect = (result: GeocodeResult) => {
    setConfirmedAddress(result.roadAddressName || result.addressName);
    setMode('confirmed');
    setQuery('');
    setResults([]);
    setHasSearched(false);
    onSelect(result);
  };

  if (mode === 'confirmed') {
    return (
      <View className="mb-4 flex-row items-center justify-between rounded-xl border border-neutral-200 px-4 py-3">
        <Text className="flex-1 text-[15px] text-neutral-800" numberOfLines={2}>
          {confirmedAddress || '주소를 선택해주세요'}
        </Text>
        <Pressable
          onPress={() => {
            setMode('search');
            setQuery('');
          }}
          hitSlop={8}
          className="ml-3 px-1 py-1"
        >
          <Text className="text-sm font-semibold text-brand-700">변경</Text>
        </Pressable>
      </View>
    );
  }

  const showEmpty = hasSearched && !loading && query.trim().length > 0 && results.length === 0;

  return (
    <View className="mb-4">
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="도로명 또는 지번 주소를 입력해주세요"
        className="rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
        autoCapitalize="none"
      />

      {loading ? (
        <View className="mt-2 flex-row items-center gap-2 px-1">
          <ActivityIndicator size="small" />
          <Text className="text-xs text-neutral-400">주소 검색 중...</Text>
        </View>
      ) : null}

      {showEmpty ? (
        <View className="mt-2 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
          <Text className="text-sm text-neutral-400">검색 결과가 없어요</Text>
        </View>
      ) : null}

      {!loading && results.length > 0 ? (
        <View className="mt-2 overflow-hidden rounded-xl border border-neutral-100 bg-white">
          {results.map((result, index) => (
            <Pressable
              key={result.id}
              onPress={() => handleSelect(result)}
              className={`px-4 py-3 active:bg-neutral-50 ${
                index > 0 ? 'border-t border-neutral-100' : ''
              }`}
            >
              <Text className="text-sm font-bold text-neutral-900">{result.addressName}</Text>
              {result.roadAddressName ? (
                <Text className="mt-0.5 text-xs text-neutral-400">{result.roadAddressName}</Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
