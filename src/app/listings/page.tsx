import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ListingCard } from "@/components/properties";
import { fetchPropertyCards } from "@/services";
import { filterPropertyCards } from "@/lib";

export const metadata = {
  title: "Listings | Sandstone Real Estate Group",
  description:
    "Browse listings curated by Sandstone Real Estate Group in El Paso and the Southwest.",
};

interface ListingsPageProps {
  searchParams: Promise<{ search?: string }>;
}

export default async function ListingsPage({ searchParams }: ListingsPageProps) {
  const params = await searchParams;
  const searchQuery = (params.search ?? "").trim();
  const properties = await fetchPropertyCards();
  const filteredProperties = filterPropertyCards(properties, searchQuery);

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[var(--sandstone-off-white)] pb-16">
        <section className="container mx-auto max-w-6xl px-4 pt-10">
          <Link
            href="/#listings"
            className="text-sm font-medium text-[var(--sandstone-sand-gold)] hover:underline"
          >
            ← Back to home listings
          </Link>
          <h1 className="mt-4 font-heading text-3xl font-bold text-[var(--sandstone-charcoal)] md:text-4xl">
            Sandstone Collection
          </h1>
          <p className="mt-2 max-w-2xl text-[var(--sandstone-charcoal)]/80">
            {searchQuery
              ? `Results for "${searchQuery}".`
              : "All available listings from our current feed."}
          </p>

          {filteredProperties.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-[var(--sandstone-navy)]/10 bg-white p-6 text-center">
              <p className="text-[var(--sandstone-charcoal)]/85">
                No listings matched <strong>{searchQuery}</strong>.
              </p>
              <Link
                href="/listings"
                className="mt-4 inline-block rounded-full bg-[var(--sandstone-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-95"
              >
                Clear search
              </Link>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProperties.map((property, index) => (
                <ListingCard
                  key={property.id}
                  property={property}
                  priority={index < 3}
                />
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
