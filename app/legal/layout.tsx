type LegalRootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function LegalRootLayout({ children }: LegalRootLayoutProps) {
  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}
