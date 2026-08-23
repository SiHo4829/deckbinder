import { NewsForm } from "@/components/features/admin/news-form";

export const dynamic = "force-dynamic";

export default function AdminNewNewsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">뉴스 작성</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          초안으로 저장한 뒤 검토하고 발행하세요. 초안은 사이트에 보이지 않습니다.
        </p>
      </div>
      <NewsForm />
    </div>
  );
}
