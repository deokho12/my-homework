import { router, Stack } from '@/navigation';
import { useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { Chip } from '@/components/Chip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { containerClass } from '@/components/layout/Container';
import { useCreateCommunityPost } from '@/features/community';
import { useProcedures } from '@/features/procedure';
import { isApiError } from '@/lib/apiClient';
import type { ProcedureId } from '@/types/domain';
import { showAlert } from '@/utils/alert';

export default function NewCommunityPostScreen() {
  const { data: procedures = [] } = useProcedures();
  const createPost = useCreateCommunityPost();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  // 'implant' 은 서버가 고정한 시술 목록의 첫 항목이다 — 목록이 아직 로딩 중이어도
  // 안전한 기본값이다.
  const [procedureId, setProcedureId] = useState<ProcedureId>('implant');

  const canSubmit = title.trim().length > 0 && content.trim().length > 0 && !createPost.isPending;

  // `createPost.isPending` 만으로는 부족하다 — 로컬 구현은 같은 tick 에 끝나서 두 번째
  // 클릭 전에 이미 `false` 로 돌아온다(연타하면 글이 두 개 등록된다). 서버로 바뀌면
  // `isPending` 이 실제로 열려 있게 되지만, 그때까지도 이 가드가 진실을 지킨다.
  const submittingRef = useRef(false);

  const handleSubmit = () => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    // `authorName` 을 보내지 않는다 — 작성자는 서버가 토큰 주체에서 정한다(위조 방지).
    createPost.mutate(
      { title: title.trim(), content: content.trim(), procedureId },
      {
        // 저장이 끝난 뒤에 돌아간다. 먼저 돌아가면 실패한 글도 등록된 것처럼 보인다.
        onSuccess: () => router.back(),
        onError: (error) => {
          // 실패는 다시 시도할 수 있어야 한다. 성공 시엔 화면을 떠나므로 풀지 않는다.
          submittingRef.current = false;
          showAlert(
            '질문을 등록하지 못했어요',
            isApiError(error) ? error.message : '잠시 후 다시 시도해주세요'
          );
        },
      }
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <Stack.Screen options={{ title: '질문하기' }} />
      <ScrollView contentContainerClassName={containerClass('form', 'pb-8 pt-4')} keyboardShouldPersistTaps="handled">
        <Text className="mb-2 text-sm font-semibold text-neutral-700">관련 시술</Text>
        <View className="mb-4 flex-row flex-wrap">
          {procedures.map((procedure) => (
            <Chip
              key={procedure.id}
              label={`${procedure.emoji} ${procedure.name}`}
              selected={procedureId === procedure.id}
              onPress={() => setProcedureId(procedure.id)}
            />
          ))}
        </View>

        <Text className="mb-2 text-sm font-semibold text-neutral-700">제목</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="궁금한 점을 한 줄로 요약해주세요"
          className="mb-4 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
        />

        <Text className="mb-2 text-sm font-semibold text-neutral-700">내용</Text>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="상황을 자세히 설명할수록 더 정확한 답변을 받을 수 있어요"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          className="mb-6 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
          style={{ minHeight: 140 }}
        />

        <PrimaryButton label="질문 등록하기" onPress={handleSubmit} disabled={!canSubmit} />
      </ScrollView>
    </SafeAreaView>
  );
}
