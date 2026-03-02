import { SiteHeader } from "@/components/SiteHeader";
import { HeroSection } from "@/components/HeroSection";
import { FeaturedListingsSection } from "@/components/sections/FeaturedListingsSection";
import { PrimaryActionTiles } from "@/components/sections/PrimaryActionTiles";
import { ContactForm } from "@/components/ContactForm";
import { SiteFooter } from "@/components/SiteFooter";
import { fetchPropertyCards } from "@/services";
import { filterPropertyCards } from "@/lib";

interface HomePageProps {
  searchParams: Promise<{ search?: string }>;
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const searchQuery = (params.search ?? "").trim();
  const properties = await fetchPropertyCards();
  const filteredProperties = filterPropertyCards(properties, searchQuery);

  return (
    <>
      <SiteHeader overlayDesktop />
      <main className="min-h-screen">
        <HeroSection initialQuery={searchQuery} />
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
