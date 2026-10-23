import { QrCode } from 'lucide-react';

import { Image } from '@/primitives';
import { router } from '@/navigation';
import { Platform, Pressable, Text, View } from '@/primitives';

import {
  address,
  APP_QR_IMAGE_URL,
  businessRegistrationNumber,
  ceoName,
  companyName,
  email,
  mailOrderBusinessNumber,
  privacyOfficerName,
} from '@/mocks/fixtures/placeholder-company-info';

/** 점선 자리의 QR 그림 — 장식이라 neutral-400 으로 둔다. */
const QR_PLACEHOLDER_COLOR = '#a3a3a3';

const LEGAL_LINKS = [
  { label: '서비스 이용약관', href: '/legal/terms' as const },
  { label: '개인정보 처리방침', href: '/legal/privacy' as const },
  { label: '위치기반 서비스 이용약관', href: '/legal/location' as const },
];

export function Footer() {
  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View className="mt-4">
      {/*
        앱 다운로드 배너. QR 이미지가 **아직 없다** — 빈 회색 상자에 `QR` 이라고만 적혀
        있으면 고장난 것처럼 보여서, 점선 자리 + "앱 출시를 준비중이에요" 안내로 바꿨다
        (HOME-3, 2026-10-23 시안 A). 이미지 주소가 채워지면 원래 안내 문구로 돌아간다.
      */}
      <View className="mb-6 flex-row items-center justify-between rounded-2xl border border-neutral-100 bg-white p-5">
        <View className="flex-1 pr-4">
          <Text className="text-base font-bold text-neutral-900">더 많은 시술정보, 앱에서 보기</Text>
          <Text className="mt-1 text-sm leading-5 text-neutral-500">
            {APP_QR_IMAGE_URL
              ? 'QR을 스캔하여 다운받아보세요'
              : '앱 출시를 준비중이에요. 준비되면 여기에 QR이 생겨요'}
          </Text>
        </View>
        {APP_QR_IMAGE_URL ? (
          <Image
            source={{ uri: APP_QR_IMAGE_URL }}
            style={{ width: 72, height: 72, borderRadius: 8 }}
            contentFit="cover"
          />
        ) : (
          // 자리 표시다 — 뜻은 왼쪽 글자가 전하므로 낭독기에서는 숨긴다.
          <View
            aria-hidden
            className="h-[72px] w-[72px] items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50"
          >
            <QrCode size={28} color={QR_PLACEHOLDER_COLOR} />
          </View>
        )}
      </View>

      {/* 하단 정보 영역 */}
      <View className="flex-row flex-wrap justify-between gap-6 rounded-2xl bg-neutral-100 p-6">
        <View className="min-w-[240px] flex-1">
          <Text className="mb-2 text-base font-extrabold text-brand-700">몰라몰라</Text>
          <Text className="text-xs leading-5 text-neutral-500">
            {companyName} | 대표 {ceoName} | 개인정보관리책임자 {privacyOfficerName}
          </Text>
          <Text className="text-xs leading-5 text-neutral-500">
            사업자등록번호 {businessRegistrationNumber} | 통신판매업신고번호 {mailOrderBusinessNumber}
          </Text>
          <Text className="text-xs leading-5 text-neutral-500">{address}</Text>
          <Text className="text-xs leading-5 text-neutral-500">{email}</Text>
          <Text className="mt-3 text-[11px] leading-4 text-neutral-500">
            몰라몰라는 통신판매의 당사자가 아니므로, 의료기관이 등록한 시술 정보 및 상담 등에 대해
            책임을 지지 않습니다.
          </Text>
        </View>

        <View className="min-w-[220px]">
          <View className="mb-4 flex-row flex-wrap items-center gap-2">
            {LEGAL_LINKS.map((link, index) => (
              <View key={link.href} className="flex-row items-center gap-2">
                {index > 0 ? <Text className="text-xs text-neutral-300">|</Text> : null}
                <Pressable onPress={() => router.push(link.href)} hitSlop={8}>
                  <Text className="text-xs font-medium text-neutral-500">{link.label}</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <View className="flex-row flex-wrap gap-2">
            <Pressable
              onPress={() => router.push('/about')}
              className="items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 py-2.5"
            >
              <Text className="text-xs font-semibold text-neutral-700">몰라몰라 알아보기</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/partner-inquiry')}
              className="items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 active:bg-brand-700"
            >
              <Text className="text-xs font-semibold text-white">병원 입점 문의</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
