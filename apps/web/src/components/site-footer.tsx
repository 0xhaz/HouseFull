import Link from 'next/link';

const REPO = 'https://github.com/0xhaz/HouseFull';

/** Guide, about and source on every page; also the map data attribution. */
export function SiteFooter() {
  return (
    <footer className="border-t print:hidden">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid size-6 place-items-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground"
          >
            HF
          </span>
          <span className="font-semibold">HouseFull</span>
          <span className="text-muted-foreground">· powered by Qloo’s taste graph</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground">
          <Link href="/guide" className="hover:text-foreground">
            User guide
          </Link>
          <Link href="/about" className="hover:text-foreground">
            About
          </Link>
          <Link href="/tonight" className="hover:text-foreground">
            Tonight
          </Link>
          <a
            href={REPO}
            className="hover:text-foreground"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <a
            href={`${REPO}/blob/main/LICENSE`}
            className="hover:text-foreground"
            target="_blank"
            rel="noopener noreferrer"
          >
            MIT license
          </a>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-6 text-xs text-muted-foreground">
        Map data © OpenStreetMap contributors. Listings from Ticketmaster. Transit data from the
        MTA.
      </p>
    </footer>
  );
}
