"use client";

import { useRouter } from "next/navigation";

import {
  Field,
  NativeSelect,
  StatusMessage,
  TextArea,
  TextInput,
} from "@/components/features/admin/field";
import { useAdminForm } from "@/components/features/admin/use-admin-form";
import { Button } from "@/components/ui/button";
import { CONTROL_CLASS } from "@/lib/utils/form";

// useAdminForm의 값은 문자열만 담는다(Record<string, string>).
// 발행 여부도 "true"/"false" 문자열로 다루고 서버 스키마가 boolean으로 바꾼다.
const EMPTY = {
  slug: "",
  title: "",
  summary: "",
  content_md: "",
  thumbnail_url: "",
  author_name: "",
  published: "false",
};

export type NewsFormValues = typeof EMPTY;

export function NewsForm({
  postId,
  initial,
}: {
  /** 있으면 수정, 없으면 새 글 */
  postId?: string;
  initial?: Partial<NewsFormValues>;
}) {
  const router = useRouter();
  const isEdit = postId !== undefined;

  const { values, setValue, status, pending, submit } = useAdminForm({
    empty: EMPTY,
    initial,
    endpoint: isEdit ? `/api/admin/news/${postId}` : "/api/admin/news",
    method: isEdit ? "PATCH" : "POST",
    // 수정 폼을 비우면 방금 고친 내용이 사라진다.
    resetOnSuccess: !isEdit,
    successText: (v) => (isEdit ? `${v.title} 저장 완료` : `${v.slug} 등록 완료`),
    onSuccess: () => router.refresh(),
  });

  return (
    <form onSubmit={submit} className="flex max-w-2xl flex-col gap-4">
      <Field
        label="슬러그"
        htmlFor="news-slug"
        hint="주소에 쓰입니다. 소문자·숫자·하이픈만. 예: op17-release"
        required
      >
        <TextInput
          id="news-slug"
          value={values.slug}
          onChange={(e) => setValue("slug", e.target.value)}
          placeholder="op17-release"
        />
      </Field>

      <Field label="제목" htmlFor="news-title" required>
        <TextInput
          id="news-title"
          value={values.title}
          onChange={(e) => setValue("title", e.target.value)}
        />
      </Field>

      <Field label="요약" htmlFor="news-summary" hint="목록과 검색 결과에 노출됩니다.">
        <TextArea
          id="news-summary"
          rows={2}
          value={values.summary}
          onChange={(e) => setValue("summary", e.target.value)}
        />
      </Field>

      <Field label="본문" htmlFor="news-content" hint="마크다운. 표·목록·링크를 쓸 수 있습니다." required>
        <textarea
          id="news-content"
          rows={16}
          value={values.content_md}
          onChange={(e) => setValue("content_md", e.target.value)}
          className={`${CONTROL_CLASS} font-mono text-xs`}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="썸네일 URL" htmlFor="news-thumbnail">
          <TextInput
            id="news-thumbnail"
            value={values.thumbnail_url}
            onChange={(e) => setValue("thumbnail_url", e.target.value)}
            placeholder="https://…"
          />
        </Field>

        <Field label="작성자" htmlFor="news-author">
          <TextInput
            id="news-author"
            value={values.author_name}
            onChange={(e) => setValue("author_name", e.target.value)}
          />
        </Field>
      </div>

      <Field
        label="발행 상태"
        htmlFor="news-published"
        hint="초안은 사이트에 보이지 않습니다."
      >
        <NativeSelect
          id="news-published"
          value={values.published}
          onChange={(e) => setValue("published", e.target.value)}
        >
          <option value="false">초안</option>
          <option value="true">발행</option>
        </NativeSelect>
      </Field>

      <StatusMessage status={status} />

      <Button type="submit" disabled={pending}>
        {pending ? "저장 중…" : isEdit ? "저장" : "등록"}
      </Button>
    </form>
  );
}
