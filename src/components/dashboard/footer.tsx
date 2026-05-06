export function Footer() {
  return (
    <footer className="border-t border-zinc-800 py-[18px]">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-center gap-x-2 px-5 font-mono text-[11px] text-zinc-700">
        <span>u24-pulse v0.1</span>
        <span aria-hidden>·</span>
        <a
          href="https://web-production-c3b4.up.railway.app/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer transition-colors hover:text-zinc-500"
        >
          API docs ↗
        </a>
      </div>
    </footer>
  );
}
