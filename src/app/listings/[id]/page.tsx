import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { fetchPropertyDetailById } from "@/services";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const property = await fetchPropertyDetailById(id);

  if (!property) {
    return { title: "Listing | Sandstone Real Estate Group" };
  }

  return {
    title: `${property.title} | Sandstone Real Estate Group`,
    description: property.description ?? `${property.location} — ${property.price}`,
  };
}

export default async function ListingPage({ params }: PageProps) {
  const { id } = await params;
  const property = await fetchPropertyDetailById(id);

  if (!property) {
    notFound();
  }

  const heroImages = property.images.slice(0, 5);
  const primaryFacts = [
    property.listingNumber && `MLS #${property.listingNumber}`,
    property.beds != null && `${property.beds} beds`,
    property.baths != null && `${property.baths} baths`,
    property.sqft && `${property.sqft} sq ft`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[var(--sandstone-off-white)] pb-20">
        <div className="container mx-auto max-w-6xl px-4 pt-8">
          <Link
            href="/listings"
            className="text-sm font-medium text-[var(--sandstone-sand-gold)] hover:underline"
          >
            ← Back to listings
          </Link>

          <section className="mt-6 overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_24px_70px_-36px_rgba(37,52,113,0.42)]">
            <div className="grid gap-3 bg-[var(--sandstone-charcoal)]/5 p-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="relative min-h-[320px] overflow-hidden rounded-[1.5rem] bg-[var(--sandstone-navy)]/8">
                <Image
                  src={heroImages[0] ?? property.image}
                  alt={property.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 66vw"
                  priority
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {heroImages.slice(1).map((image, index) => (
                  <div
                    key={`${property.id}-${index + 1}`}
                    className="relative min-h-[154px] overflow-hidden rounded-[1.25rem] bg-[var(--sandstone-navy)]/8"
                  >
                    <Image
                      src={image}
                      alt={`${property.title} photo ${index + 2}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 50vw, 22vw"
                    />
                  </div>
                ))}
                {heroImages.length === 1 && (
                  <div className="col-span-2 flex min-h-[154px] items-center justify-center rounded-[1.25rem] border border-dashed border-[var(--sandstone-navy)]/15 bg-[var(--sandstone-off-white)] px-6 text-center text-sm text-[var(--sandstone-charcoal)]/65">
                    Additional listing photos will appear here when Spark provides them.
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-10 px-6 py-8 md:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--sandstone-sand-gold)]">
                  Listing Detail
                </p>
                <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-heading text-3xl font-bold text-[var(--sandstone-charcoal)] md:text-4xl">
                      {property.price}
                    </p>
                    <h1 className="mt-2 font-heading text-2xl font-bold text-[var(--sandstone-navy)] md:text-3xl">
                      {property.title}
                    </h1>
                    <p className="mt-2 text-base text-[var(--sandstone-charcoal)]/78">
                      {property.location}
                    </p>
                    {primaryFacts && (
                      <p className="mt-4 text-sm text-[var(--sandstone-charcoal)]/68">
                        {primaryFacts}
                      </p>
                    )}
                  </div>

                  <Link
                    href="/#contact"
                    className="inline-flex items-center justify-center rounded-full bg-[var(--sandstone-sand-gold)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-95"
                  >
                    Schedule a tour
                  </Link>
                </div>

                {property.description && (
                  <div className="mt-8 rounded-[1.5rem] bg-[var(--sandstone-off-white)]/85 p-6">
                    <h2 className="font-heading text-xl font-bold text-[var(--sandstone-navy)]">
                      Property Description
                    </h2>
                    <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[var(--sandstone-charcoal)]/82">
                      {property.description}
                    </p>
                  </div>
                )}
              </div>

              <aside className="rounded-[1.75rem] border border-[var(--sandstone-navy)]/10 bg-[var(--sandstone-off-white)]/88 p-6">
                <h2 className="font-heading text-xl font-bold text-[var(--sandstone-navy)]">
                  Quick Facts
                </h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  {property.metadataSections
                    .flatMap((section) => section.items)
                    .slice(0, 8)
                    .map((item) => (
                      <div
                        key={`${item.label}-${item.value}`}
                        className="rounded-2xl bg-white px-4 py-3 shadow-sm"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--sandstone-charcoal)]/48">
                          {item.label}
                        </p>
                        <p className="mt-1 text-sm text-[var(--sandstone-charcoal)]/82">
                          {item.value}
                        </p>
                      </div>
                    ))}
                </div>
              </aside>
            </div>
          </section>

          <section className="mt-10 grid gap-6">
            {property.metadataSections.map((section) => (
              <article
                key={section.title}
                className="rounded-[1.75rem] border border-[var(--sandstone-navy)]/10 bg-white px-6 py-6 shadow-[0_20px_50px_-42px_rgba(37,52,113,0.45)]"
              >
                <h2 className="font-heading text-xl font-bold text-[var(--sandstone-navy)]">
                  {section.title}
                </h2>
                <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                  {section.items.map((item) => (
                    <div key={`${section.title}-${item.label}`} className="border-t border-[var(--sandstone-navy)]/8 pt-4">
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--sandstone-charcoal)]/48">
                        {item.label}
                      </dt>
                      <dd className="mt-2 text-sm leading-6 text-[var(--sandstone-charcoal)]/84">
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
