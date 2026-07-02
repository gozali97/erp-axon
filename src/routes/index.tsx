import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import heroDashboard from "@/assets/hero-dashboard.jpg";
import entityDiagram from "@/assets/entity-diagram.jpg";
import verticalManufacturing from "@/assets/vertical-manufacturing.jpg";
import verticalHealthcare from "@/assets/vertical-healthcare.jpg";
import verticalRetail from "@/assets/vertical-retail.jpg";
import verticalConstruction from "@/assets/vertical-construction.jpg";

export const Route = createFileRoute("/")({
  component: Index,
});

const defaultContent = {
  hero: {
    eyebrow: "Modular ERP Architecture",
    title: "The Operating System for Complex Mid-Market Ops.",
    subtitle:
      "Consolidate Sales, Inventory, and Accounting into a single API-first backbone. Built for multi-entity structures that have outgrown Odoo and reject SAP overhead.",
    ctaPrimary: "Deploy Instance",
    ctaSecondary: "View API Schema",
  },
  tagline: { text: "Dipercaya SME & mid-market Indonesia" },
  cta: {
    title: "Stop paying for features you don't deploy.",
    subtitle: "Modular pricing starts at $499/mo + compute usage. No per-seat penalties, no vendor lock-in.",
    button: "Talk to Solutions Architect",
  },
};

function useLandingContent() {
  const [content, setContent] = useState(defaultContent);
  useEffect(() => {
    supabase
      .from("cms_landing_content")
      .select("key, value")
      .then(({ data }) => {
        if (!data) return;
        const merged = { ...defaultContent };
        data.forEach((row) => {
          const key = row.key as keyof typeof defaultContent;
          const val = (row.value ?? {}) as Record<string, string>;
          if (key in merged) {
            (merged as Record<string, Record<string, string>>)[key] = {
              ...(merged as Record<string, Record<string, string>>)[key],
              ...val,
            };
          }
        });
        setContent(merged);
      });
  }, []);
  return content;
}


const modules = [
  { code: "01.SALES", name: "Unified Commerce", desc: "Omnichannel orders & automated invoicing workflows." },
  { code: "02.INV", name: "Smart Inventory", desc: "Multi-warehouse tracking with predictive replenishment." },
  { code: "03.ACC", name: "Core Accounting", desc: "Double-entry ledger with real-time tax mapping." },
  { code: "04.MFG", name: "MRP II System", desc: "BOM management and workstation capacity planning." },
  { code: "05.HRM", name: "Human Capital", desc: "Global payroll across multi-jurisdictional entities." },
  { code: "06.POS", name: "Cloud POS", desc: "High-concurrency retail points with offline sync." },
  { code: "07.CRM", name: "Client Relations", desc: "Context-aware lead management and support tickets." },
  { code: "08.PRC", name: "Procurement", desc: "Vendor portals and automated purchase approvals." },
  { code: "09.WMS", name: "Advanced Warehousing", desc: "Barcoding, RFID integration, and picking routes." },
  { code: "10.ANA", name: "BI & Analytics", desc: "OLAP cube processing for instant data visibility." },
  { code: "11.PRJ", name: "Project Costing", desc: "Job costing tied to timesheets and billing." },
  { code: "12.QC", name: "Quality Control", desc: "Inspections, batch tracking, and compliance." },
  { code: "13.HLP", name: "Helpdesk", desc: "SLA-driven ticketing across customer channels." },
  { code: "14.API", name: "Public API", desc: "Every action exposed via versioned REST." },
];

const verticals = [
  { title: "Discrete Manufacturing", desc: "Precision MRP for high-complexity assembly lines.", img: verticalManufacturing },
  { title: "Healthcare & Life Sciences", desc: "HIPAA-aligned supply chain and asset tracking.", img: verticalHealthcare },
  { title: "High-Volume Retail", desc: "Real-time POS sync for 100+ branch operations.", img: verticalRetail },
  { title: "Project-Based Construction", desc: "Complex job costing and subcontractor management.", img: verticalConstruction },
];

const comparisons = [
  { label: "Implementation Speed", legacy: "NETSUITE: 8MO", axon: "AXON: 14 DAYS" },
  { label: "API Coverage", legacy: "SAP: PARTIAL", axon: "AXON: 100% HEADLESS" },
  { label: "Pricing Model", legacy: "ODOO: PER USER", axon: "AXON: USAGE-BASED" },
  { label: "Multi-Entity Consolidation", legacy: "SAP: PLUGINS", axon: "AXON: NATIVE CORE" },
];

function Index() {
  const content = useLandingContent();
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="font-extrabold tracking-tighter text-xl">AXON.</span>
            <div className="hidden md:flex gap-6 text-sm font-medium text-muted">
              <a href="#modules" className="hover:text-foreground transition-colors">Modules</a>
              <a href="#industries" className="hover:text-foreground transition-colors">Industries</a>
              <a href="#compare" className="hover:text-foreground transition-colors">Compare</a>
              <Link to="/blog" className="hover:text-foreground transition-colors">Blog</Link>
              <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline font-mono text-[10px] text-green-700 bg-green-50 px-2 py-0.5 border border-green-200">
              v4.2.0 STABLE
            </span>
            <Link to="/auth" className="text-sm font-medium hover:text-primary transition-colors">
              Sign in
            </Link>
            <Link to="/auth" search={{ redirect: "/app" }} className="px-4 py-2 bg-foreground text-background text-sm font-bold rounded hover:bg-foreground/90 transition-all">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="pt-24 pb-16 px-6 max-w-7xl mx-auto">
        <div className="max-w-3xl mb-16 animate-slide">
          <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-4 font-bold">
            {content.hero.eyebrow}
          </div>
          <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight leading-[0.9] mb-8 text-balance">
            {content.hero.title}
          </h1>
          <p className="text-xl text-muted-foreground max-w-[50ch] mb-10 leading-relaxed">
            {content.hero.subtitle}
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to="/auth" search={{ redirect: "/app" }} className="px-8 py-4 bg-primary text-primary-foreground font-bold rounded text-lg hover:shadow-lg hover:shadow-primary/20 transition-all">
              {content.hero.ctaPrimary}
            </Link>
            <a href="#modules" className="px-8 py-4 bg-background border border-border font-bold rounded text-lg hover:bg-surface transition-all">
              {content.hero.ctaSecondary}
            </a>
          </div>
        </div>


        <div className="animate-draw border border-border bg-background rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-surface-2">
            <div className="flex gap-1.5">
              <div className="size-2.5 rounded-full bg-stone-300" />
              <div className="size-2.5 rounded-full bg-stone-300" />
              <div className="size-2.5 rounded-full bg-stone-300" />
            </div>
            <div className="mx-auto text-[10px] font-mono text-muted-foreground uppercase tracking-tighter">
              Entity Control Center / Global Dashboard
            </div>
          </div>
          <img
            src={heroDashboard}
            alt="Axon ERP dashboard showing multi-branch inventory metrics and financial charts"
            width={1408}
            height={768}
            className="w-full aspect-[21/10] object-cover"
          />
        </div>
      </header>

      {/* Modules */}
      <section id="modules" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Full-Spectrum Modularity</h2>
            <p className="text-muted-foreground font-mono text-xs mt-2">
              [SELECTED_CAPABILITIES: {modules.length}_MODULES_DETECTED]
            </p>
          </div>
          <div className="h-px flex-1 mx-8 bg-border hidden md:block" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-px bg-border border border-border">
          {modules.map((m) => (
            <div key={m.code} className="bg-background p-6 hover:bg-surface-2 transition-colors">
              <div className="font-mono text-[10px] text-muted-foreground mb-4">{m.code}</div>
              <div className="font-bold mb-2">{m.name}</div>
              <div className="text-xs text-muted-foreground leading-tight">{m.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section id="compare" className="py-24 bg-foreground text-background overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-extrabold tracking-tight mb-8 leading-tight">
                Engineered to outpace
                <br />
                legacy monoliths.
              </h2>
              <p className="text-background/60 text-lg mb-12">
                Why teams are migrating from SAP Business One, NetSuite, and Odoo to Axon's atomic
                architecture.
              </p>

              <div className="space-y-4">
                {comparisons.map((c) => (
                  <div
                    key={c.label}
                    className="flex justify-between items-center py-4 border-b border-white/10"
                  >
                    <span className="font-medium">{c.label}</span>
                    <div className="flex gap-4 items-center">
                      <span className="text-xs text-background/40 font-mono hidden sm:inline">
                        {c.legacy}
                      </span>
                      <span className="text-primary font-bold text-sm">{c.axon}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-10 bg-primary/20 blur-3xl rounded-full" />
              <div className="relative border border-white/10 bg-white/5 backdrop-blur-sm p-8 rounded-xl">
                <div className="font-mono text-xs text-primary mb-4">// MULTI_ENTITY_HIERARCHY</div>
                <img
                  src={entityDiagram}
                  alt="Blueprint diagram of multi-company entity hierarchy"
                  width={768}
                  height={768}
                  loading="lazy"
                  className="w-full aspect-square object-cover rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Verticals */}
      <section id="industries" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="mb-12">
          <h2 className="text-3xl font-extrabold tracking-tight">Purpose-built Configurations</h2>
          <p className="text-muted-foreground font-mono text-xs mt-2">
            [INDUSTRY_KERNELS: SHIP_WITH_STARTER_TEMPLATES]
          </p>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {verticals.map((v) => (
            <div key={v.title} className="group cursor-pointer">
              <div className="aspect-[3/4] bg-surface rounded-lg overflow-hidden relative mb-4">
                <img
                  src={v.img}
                  alt={v.title}
                  width={608}
                  height={800}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors" />
              </div>
              <h3 className="font-bold">{v.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="mb-24 px-6">
        <div className="max-w-7xl mx-auto bg-surface border border-border p-12 md:p-24 rounded-2xl text-center relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 whitespace-pre-line">
              {content.cta.title}
            </h2>
            <p className="text-lg text-muted-foreground mb-12 max-w-xl mx-auto">
              {content.cta.subtitle}
            </p>
            <div className="flex justify-center gap-4">
              <Link to="/auth" search={{ redirect: "/app" }} className="px-10 py-5 bg-foreground text-background font-bold rounded hover:bg-foreground/90 transition-all">
                {content.cta.button}
              </Link>
            </div>
          </div>
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <span className="font-mono text-[12vw] leading-none select-none">AXON</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col gap-2">
            <span className="font-extrabold tracking-tighter text-xl">AXON.</span>
            <p className="text-xs text-muted-foreground">
              © 2026 Axon Systems. Engineered for the mid-market.
            </p>
          </div>
          <div className="flex gap-8 text-xs font-mono text-muted-foreground uppercase tracking-widest">
            <a href="#" className="hover:text-primary transition-colors">Status</a>
            <a href="#" className="hover:text-primary transition-colors">Security</a>
            <a href="#" className="hover:text-primary transition-colors">Terms</a>
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
