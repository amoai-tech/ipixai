import Link from "next/link";
import { Building2, Camera, ClipboardList } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { buildHeroGreeting } from "@/lib/dashboard/command-center";
import type { DashboardBrand, DashboardShoot } from "@/lib/dashboard/command-center";

import styles from "./command-center.module.css";
import { QuickActionChips } from "./quick-action-chips";

type BrandsResult = { ok: true; brands: DashboardBrand[] } | { ok: false };
type ShootsResult = { ok: true; shoots: DashboardShoot[] } | { ok: false };

type Props = {
  brandsResult: BrandsResult;
  shootsResult: ShootsResult;
  /** shootId -> signed preview URL, from loadRecentWorkPreviews. A shoot
   *  missing from this map (including when it's empty/omitted) renders the
   *  honest placeholder, same as before this existed. */
  recentWorkPreviews?: Map<string, string>;
};

const QUICK_LINKS = [
  {
    key: "brands",
    href: "/app/brands",
    icon: Building2,
    title: "Brands",
    body: "Browse and open brand profiles.",
  },
  {
    key: "shoots",
    href: "/app/shoots",
    icon: Camera,
    title: "Shoots",
    body: "Browse and open shoot records.",
  },
  {
    key: "plans",
    href: "/app/plans",
    icon: ClipboardList,
    title: "Plans",
    body: "Enter the production planning workspace.",
  },
] as const;

/**
 * DASH-MAIN-001/002 Command Center. COPY+CLEAN of the Lumina status-strip /
 * hero / recent-work layout (github.com/amoai-tech/luminaai, pinned SHA
 * b2d3de8e), ADAPTed to org-scoped server data and current DESIGN-001 atoms
 * (Card, EmptyState, ErrorState) instead of Lumina's `CommandCenterBrandSync`
 * / sample-image fixtures.
 *
 * Deliberately dropped vs. Lumina: fashion-stock-photo fallbacks (a shoot
 * with no authorized asset still renders an honest no-image tile — brands
 * have no real cover column, and shoots' `cover_url` is never rendered
 * directly, see the `.recentThumb` comment below), the `?skip=1`/
 * `?skip=approval` dev-preview bypasses, and the approvals block (no owning
 * source until
 * IPI-1084 · APPROVAL-001 — Let Operators Review, Edit, Approve, or Reject
 * AI Plans Before Anything Is Saved ships — see the Linear issue).
 *
 * Brands and Shoots are independent reads/sections — a failed or empty
 * result in one never blocks or hides the other, and Quick links are
 * static and stay usable regardless of either query's outcome. Planner
 * stays off this page; it's optional per accepted scope.
 */
function dnaBadgeClass(score: number): string {
  if (score >= 80) return `${styles.recentDnaBadge} ${styles.recentDnaHigh}`;
  if (score >= 60) return `${styles.recentDnaBadge} ${styles.recentDnaMid}`;
  return `${styles.recentDnaBadge} ${styles.recentDnaLow}`;
}

/**
 * COPY+CLEAN of Lumina's PortfolioHeroCard hierarchy: media, "Production
 * Planner" label, then a real-data-only headline/subline (buildHeroGreeting).
 */
function HeroCard({
  brand,
  recentShootName,
}: {
  brand: DashboardBrand;
  recentShootName: string | undefined;
}) {
  const greeting = buildHeroGreeting({ brandName: brand.name, recentShootName });
  return (
    <div className={styles.heroCard} data-testid="command-center-hero">
      {/* No stock photo standing in for a real brand cover — brands don't
          have one yet, so this is an honest initial avatar. */}
      <span className={styles.heroAvatar} aria-hidden>
        {brand.name.charAt(0).toUpperCase()}
      </span>
      <div className={styles.heroBody}>
        <p className={styles.heroPlannerLabel}>
          <span className={styles.heroPlannerDot} aria-hidden />
          Production Planner
        </p>
        <h2 className={styles.heroName}>{greeting.headline}</h2>
        <p className={styles.heroSubline}>{greeting.subline}</p>
      </div>
    </div>
  );
}

export function CommandCenter({
  brandsResult,
  shootsResult,
  recentWorkPreviews = new Map(),
}: Props) {
  const heroBrand = brandsResult.ok ? brandsResult.brands[0] : undefined;
  // "Live" would claim a continuously-current feed this page doesn't have —
  // no websocket/realtime signal backs it. This says only what's actually
  // true: whether this request's own reads succeeded — never "ready" while
  // an ErrorState is rendering right below it.
  const hasLoadError = !brandsResult.ok || !shootsResult.ok;
  // Shoots load org-wide, not scoped to heroBrand — shoots[0] alone could
  // name a different brand's most recent shoot under this brand's hero
  // copy. Match on brandId so the hero never implies a false association.
  const recentShootName = shootsResult.ok
    ? shootsResult.shoots.find((shoot) => shoot.brandId === heroBrand?.id)?.name
    : undefined;

  return (
    <div className={styles.root} data-testid="command-center">
      <p className={styles.statusStrip} data-tone={hasLoadError ? "warn" : undefined}>
        <span className={styles.statusDot} aria-hidden />
        <span className={styles.statusLabel}>
          {hasLoadError ? "Workspace loaded" : "Workspace ready"}
        </span>
        <span>
          {hasLoadError ? "Some data couldn't be refreshed." : "Data loaded for this session."}
        </span>
      </p>

      <header className={styles.hero}>
        <h1 className={styles.heading}>Dashboard</h1>
        <p className={styles.subheading}>Your organization&apos;s brands.</p>
      </header>

      {heroBrand && <HeroCard brand={heroBrand} recentShootName={recentShootName} />}

      <QuickActionChips />

      <section aria-labelledby="command-center-brands">
        <h2 id="command-center-brands" className={styles.sectionHeading}>
          Recent brands
        </h2>
        {!brandsResult.ok ? (
          <ErrorState message="Couldn't load your brands. Please try again shortly." />
        ) : brandsResult.brands.length === 0 ? (
          <EmptyState
            heading="No brands yet"
            body="Brands your organization creates will show up here."
            icon={<Building2 aria-hidden />}
            action={
              <Link href="/app/brands" className={styles.link}>
                Go to Brands
              </Link>
            }
          />
        ) : (
          <ul className={styles.grid} data-testid="command-center-brand-list">
            {brandsResult.brands.map((brand) => (
              <li key={brand.id}>
                <Link href="/app/brands" className={styles.brandCardLink}>
                  <Card>
                    <CardHeader>
                      <CardTitle className={styles.brandName}>{brand.name}</CardTitle>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="command-center-shoots">
        <div className={styles.recentHeader}>
          <h2 id="command-center-shoots" className={styles.sectionHeading}>
            Recent work
          </h2>
          <Link href="/app/shoots" className={styles.recentViewAll}>
            View all
          </Link>
        </div>
        {!shootsResult.ok ? (
          <ErrorState message="Couldn't load your shoots. Please try again shortly." />
        ) : shootsResult.shoots.length === 0 ? (
          <EmptyState
            heading="No shoots yet"
            body="Shoots your organization creates will show up here."
            icon={<Camera aria-hidden />}
            action={
              <Link href="/app/shoots" className={styles.link}>
                Go to Shoots
              </Link>
            }
          />
        ) : (
          <div className={styles.recentScroll} data-testid="command-center-shoot-list">
            {shootsResult.shoots.map((shoot) => (
              <Link key={shoot.id} href="/app/shoots" className={styles.recentTile}>
                <div className={styles.recentThumb}>
                  {/* shoot_portfolio_view.cover_url (mood_board_urls) is
                      never rendered directly — no bridge to this app's one
                      proven secure-delivery contract. The real cover here
                      comes only from loadRecentWorkPreviews: a shoot-linked
                      `assets` row with an `authenticated`-type Cloudinary
                      mirror, signed by get-authorized-asset-preview.ts
                      (IPI-1112 · CLD-DELIVERY-001). No entry for this shoot
                      in the map means no authorized asset exists yet —
                      honest no-image placeholder, not a fabricated cover. */}
                  {recentWorkPreviews.get(shoot.id) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed, expiring URL; Next/Image would re-request/re-optimize it server-side
                    <img
                      src={recentWorkPreviews.get(shoot.id)}
                      alt=""
                      className={styles.recentImage}
                    />
                  ) : (
                    <span className={styles.recentThumbPlaceholder} aria-hidden>
                      <Camera />
                    </span>
                  )}
                  {typeof shoot.dnaScore === "number" && (
                    <span
                      className={dnaBadgeClass(shoot.dnaScore)}
                      aria-label={`DNA score: ${Math.round(shoot.dnaScore)}`}
                    >
                      {Math.round(shoot.dnaScore)}
                    </span>
                  )}
                </div>
                <p className={styles.recentTitle}>{shoot.name}</p>
                {shoot.channel && <p className={styles.recentMeta}>{shoot.channel}</p>}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="command-center-quick-links">
        <h2 id="command-center-quick-links" className={styles.sectionHeading}>
          Quick links
        </h2>
        <div className={styles.quickLinks}>
          {QUICK_LINKS.map(({ key, href, icon: Icon, title, body }) => (
            <Card key={key} className={styles.quickLinkCard}>
              <CardContent className={`${styles.quickLinkContent} pt-6`}>
                <Icon aria-hidden className={styles.quickLinkIcon} />
                <div>
                  <p className={styles.quickLinkTitle}>{title}</p>
                  <p className={styles.quickLinkBody}>{body}</p>
                </div>
                {/* Distinct accessible name per link — three "Open" links are
                    indistinguishable to screen readers / voice control. */}
                <Link href={href} className={styles.link} aria-label={`Open ${title}`}>
                  Open
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
