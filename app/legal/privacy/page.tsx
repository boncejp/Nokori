import type { Metadata } from "next";

import { LegalDocLayout, LegalSection } from "@/components/legal/LegalDocLayout";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description: "Nokori のプライバシーポリシーです。",
};

const CONTACT_EMAIL = "dohee.lee12321@gmail.com";

export default function PrivacyPage() {
  return (
    <LegalDocLayout title="プライバシーポリシー">
      <LegalSection title="1. はじめに">
        <p>
          Nokori 運営者（以下「運営者」といいます。）は、個人開発による無償の家計管理サービス「Nokori」（以下「本サービス」といいます。）において、ユーザーの個人情報および関連情報を適切に取り扱います。本ポリシーは、本サービスが現時点で実装しているデータの扱いと矛盾しない範囲で記載しています。
        </p>
      </LegalSection>

      <LegalSection title="2. 取得する情報">
        <p>本サービスでは、例えば以下の情報を取得・保存する場合があります。</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-medium text-slate-800">認証情報</strong>
            ：メールアドレス、Google アカウントを通じて認証プロバイダが提供する識別子等（Supabase Auth を通じて処理されます）。
          </li>
          <li>
            <strong className="font-medium text-slate-800">アプリ利用データ</strong>
            ：プロフィール（貯金目標・予算設定等）、取引・支出等の入力内容。これらは Supabase 上のデータベース（例：
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">public.profiles</code>、
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">public.transactions</code>
            に相当する領域）に保存されます。
          </li>
          <li>
            <strong className="font-medium text-slate-800">技術情報</strong>
            ：アクセスログ、Cookie、デバイス・ブラウザに関する情報等が、ホスティング事業者や認証インフラの仕様により自動的に記録される場合があります。
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. 利用目的">
        <p>取得した情報は、以下の目的で利用します。</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>本サービスの提供・本人確認・ログイン維持</li>
          <li>家計・予算に関する画面表示および集計</li>
          <li>障害対応、不正利用の防止、セキュリティの維持</li>
          <li>法令遵守および運営者が合理的に必要と判断する運営上の対応</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. 運営者によるアクセス">
        <p>
          運営者は、上記利用目的の達成、運営・障害対応・不正防止・法令遵守のために、必要な範囲でデータベースおよび認証基盤上のデータにアクセスし、閲覧・確認・修正・削除等の措置をとることがあります。
        </p>
      </LegalSection>

      <LegalSection title="5. 保存期間と削除">
        <p>
          アプリ上のデータは、ユーザーが本サービス内の設定から「データ初期化」を実行した場合、当該ユーザーに紐づく取引データおよびプロフィール行（データベース上の該当レコード）が削除される実装になっています。初期化後は、オンボーディングから再度プロフィールを登録する流れになります。
        </p>
        <p>
          ログイン用の認証アカウント（Supabase Auth のユーザー）が、当該操作のみで自動的に消去される実装は提供していない場合があります。認証アカウントの削除を含めた完全な消去を希望される場合は、第9条の問い合わせ先までご連絡ください。
        </p>
        <p>ユーザーが長期間本サービスを利用しない場合のデータ削除ポリシーは、現時点では個別に定めていない場合があります。必要に応じて本ポリシーを更新します。</p>
      </LegalSection>

      <LegalSection title="6. 第三者への委託（サブプロセッサ）">
        <p>本サービスの提供にあたり、主として以下の事業者に処理を委託します。</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-medium text-slate-800">Supabase Inc.</strong>
            （データベース・認証等）—{" "}
            <a
              href="https://supabase.com/privacy"
              className="text-slate-900 underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              プライバシー
            </a>
            、{" "}
            <a
              href="https://supabase.com/terms"
              className="text-slate-900 underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              利用規約
            </a>
          </li>
          <li>
            <strong className="font-medium text-slate-800">Vercel Inc.</strong>
            （ホスティング等）—{" "}
            <a
              href="https://vercel.com/legal/privacy-policy"
              className="text-slate-900 underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              プライバシーポリシー
            </a>
            、{" "}
            <a
              href="https://vercel.com/legal/terms"
              className="text-slate-900 underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              利用規約
            </a>
          </li>
          <li>
            <strong className="font-medium text-slate-800">Google LLC</strong>
            （Google でのログインを利用する場合の OAuth 等）—{" "}
            <a
              href="https://policies.google.com/privacy"
              className="text-slate-900 underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              プライバシーポリシー
            </a>
            、{" "}
            <a
              href="https://policies.google.com/terms"
              className="text-slate-900 underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              利用規約
            </a>
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. 第三者提供">
        <p>
          運営者は、法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供しません。委託先による処理は、委託の範囲内での利用に限られます。
        </p>
      </LegalSection>

      <LegalSection title="8. Cookie 等">
        <p>
          本サービスおよび利用インフラは、セッション維持・セキュリティ・分析等のために Cookie や類似の技術を使用することがあります。
        </p>
      </LegalSection>

      <LegalSection title="9. お問い合わせ・開示等の請求">
        <p>
          本ポリシーに関するお問い合わせ、保有個人データの開示・訂正・利用停止等のご希望は、以下の連絡先にメールでご連絡ください。本人確認のため、運営者が合理的と判断する方法をお願いする場合があります。
        </p>
        <p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-slate-900 underline underline-offset-2"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </LegalSection>

      <LegalSection title="10. 改定">
        <p>
          運営者は、法令の改正や本サービスの内容に応じて、本ポリシーを随時改定できます。改定後のポリシーは、本サービス上に掲示した時点から効力を生じます。
        </p>
      </LegalSection>

      <p className="text-xs text-zinc-500">
        本ポリシーは一般的な体裁で作成したものであり、法的助言を構成するものではありません。
      </p>
    </LegalDocLayout>
  );
}
