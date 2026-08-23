import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { Footer } from "@/components/common/footer";
import { Header } from "@/components/common/header";
import { ThemeProvider } from "@/components/common/theme-provider";
import { clientEnv } from "@/lib/env";
import { QueryProvider } from "@/lib/query/provider";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION = "TCG 플레이어와 컬렉터를 위한 종합 서포팅 웹 플랫폼";

export const metadata: Metadata = {
  // 없으면 OG 이미지·canonical의 상대경로가 해석되지 않는다.
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default: "덱바인더 (DeckBinder)",
    template: "%s | 덱바인더",
  },
  description: DESCRIPTION,
  applicationName: "덱바인더",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "덱바인더",
    locale: "ko_KR",
    url: "/",
    title: "덱바인더 (DeckBinder)",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      // next-themes가 하이드레이션 전에 html의 class를 바꾸므로 경고를 억제한다.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NuqsAdapter>
            <QueryProvider>
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </QueryProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  );
}
