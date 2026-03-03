import { SiteHeader } from "@/components/SiteHeader";
import { HeroSection } from "@/components/HeroSection";
import { FeaturedListingsSection } from "@/components/sections/FeaturedListingsSection";
import { PrimaryActionTiles } from "@/components/sections/PrimaryActionTiles";
import { ContactForm } from "@/components/ContactForm";
import { SiteFooter } from "@/components/SiteFooter";
import { fetchMyPropertyCards } from "@/services";
import { filterPropertyCards } from "@/lib";

interface HomePageProps {
  searchParams: Promise<{ search?: string; proximity?: string }>;
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const searchQuery = (params.search ?? "").trim();
  const proximityFilter = (params.proximity ?? "").trim();
  const properties = await fetchMyPropertyCards();
  const filteredProperties = filterPropertyCards(properties, searchQuery, proximityFilter);

  return (
    <>
      <SiteHeader overlayDesktop />
      <main className="min-h-screen">
        <HeroSection initialQuery={searchQuery} initialProximity={proximityFilter} />
        <FeaturedListingsSection
          properties={filteredProperties}
          searchQuery={searchQuery}
        />
        <PrimaryActionTiles />
        <ContactForm />
      </main>
      <SiteFooter />
    </>
  );
}
