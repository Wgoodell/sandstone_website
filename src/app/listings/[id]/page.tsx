import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { fetchPropertyCardById } from "@/services";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const property = await fetchPropertyCardById(id);
  if (!property) return { title: "Listing | Sandstone Real Estate Group" };
  return {
    title: `${property.title} | Sandstone Real Estate Group`,
    description: `${property.location} — ${property.price}`,
  };
}

export default async function ListingPage({ params }: PageProps) {
  const { id } = await params;
  const property = await fetchPropertyCardById(id);

  if (!property) notFound();

  const details = [
    property.beds != null && `${property.beds} beds`,
    property.baths != null && `${property.baths} baths`,
    property.sqft && `${property.sqft} sq ft`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[var(--sandstone-off-white)] pb-16">
        <div className="container mx-auto max-w-4xl px-4 pt-8">
          <Link
            href="/listings"
            className="text-sm font-medium text-[var(--sandstone-sand-gold)] hover:underline"
          >
            ← Back to listings
          </Link>
          <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-lg">
            <div className="relative aspect-[16/10] w-full">
              <Image
                src={property.image}
                alt={property.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 896px"
                priority
              />
            </div>
            <div className="p-6 md:p-8">
              <p className="font-heading text-2xl font-bold text-[var(--sandstone-charcoal)]">
                {property.price}
              </p>
              <h1 className="mt-2 font-heading text-2xl font-bold text-[var(--sandstone-navy)] md:text-3xl">
                {property.title}
              </h1>
              <p className="mt-2 text-[var(--sandstone-charcoal)]/80">
                {property.location}
              </p>
              {details && (
                <p className="mt-4 text-sm text-[var(--sandstone-charcoal)]/70">
                  {details}
                </p>
              )}
              <Link
                href="/#contact"
                className="mt-8 inline-block rounded-full bg-[var(--sandstone-sand-gold)] px-6 py-3 font-semibold text-white hover:opacity-95"
              >
                Schedule a tour
              </Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
