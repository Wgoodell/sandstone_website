import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LeadCaptureSection } from "@/components/LeadCaptureSection";

export const metadata = {
  title: "Rent My House | Sandstone Real Estate Group!",
  description: "Rental expertise in El Paso. We help landlords and tenants find the right fit.",
};

export default function RentPage() {
  return (
    <>
      <SiteHeader variant="lead" showDesktopCenterLogo={false} />
      <main className="min-h-screen bg-[var(--sandstone-off-white)]">
        <LeadCaptureSection
          formType="rent"
          sectionId="rent-lead"
          heading="Rent My House"
          subheading="Share your rental goals and property details, and we&apos;ll help you map the next steps."
          showAside={false}
          ctaLabel="START MY RENTAL CONSULTATION"
          messagePlaceholder="Tell us about the rental property, availability, and what kind of support you need..."
        />
      </main>
      <SiteFooter />
    </>
  );
}
