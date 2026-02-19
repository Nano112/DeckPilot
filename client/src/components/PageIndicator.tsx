import type { PageConfig } from "shared";

interface PageIndicatorProps {
  pages: PageConfig[];
  activePage: number;
  onPageChange: (index: number) => void;
}

export function PageIndicator({ pages, activePage, onPageChange }: PageIndicatorProps) {
  if (pages.length <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-2 bg-[var(--bg-secondary)]">
      {pages.map((page, i) => (
        <button
          key={page.id}
          onClick={() => onPageChange(i)}
          className="border-0 rounded-full cursor-pointer transition-all"
          style={{
            width: i === activePage ? 24 : 8,
            height: 8,
            backgroundColor:
              i === activePage ? "var(--accent)" : "var(--text-secondary)",
            opacity: i === activePage ? 1 : 0.4,
          }}
        />
      ))}
    </div>
  );
}
