import { router, Stack } from '@/navigation';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { Chip } from '@/components/Chip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { procedures } from '@/mocks/fixtures/procedures';
import { useCommunityStore } from '@/store/useCommunityStore';
import type { ProcedureId } from '@/types/domain';

export default function NewCommunityPostScreen() {
  const addPost = useCommunityStore((state) => state.addPost);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [procedureId, setProcedureId] = useState<ProcedureId>(procedures[0].id);

  const canSubmit = title.trim().length > 0 && content.trim().length > 0;

  const handleSubmit = () => {
    addPost({ title: title.trim(), content: content.trim(), procedureId, authorName: '익명' });
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <Stack.Screen options={{ title: '질문하기' }} />
      <ScrollView contentContainerClassName="px-5 pb-8 pt-4" keyboardShouldPersistTaps="handled">
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
