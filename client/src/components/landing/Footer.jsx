import React from "react";
import { Link } from "react-router-dom";
import { useSiteContent } from "@/contexts/SiteContentContext";

export default function Footer() {
  const { settings } = useSiteContent();
  const { footer, header } = settings;

  return (
    <footer className="border-t border-border/70 bg-card/85">
      <div className="luxe-shell py-16 lg:py-20">
        <div className="mb-10 rounded-[28px] border border-border/70 bg-[linear-gradient(135deg,hsl(var(--card)),hsl(var(--secondary))/0.75)] p-8 shadow-[0_18px_55px_hsl(var(--foreground)/0.05)] lg:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="luxe-eyebrow mb-3">{footer.newsletterEyebrow}</p>
              <h3 className="luxe-heading text-3xl">{footer.newsletterTitle}</h3>
            </div>
            <div className="flex w-full max-w-md items-center gap-3 rounded-full border border-border bg-background/75 p-2">
              <input
                type="email"
                placeholder={footer.newsletterPlaceholder}
                className="h-11 flex-1 bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button className="rounded-full bg-primary px-5 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary-foreground">
                {footer.newsletterButtonLabel}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4 mb-12">
          <div>
            <span className="mb-4 flex flex-col">
              <span className="font-display text-[34px] font-semibold leading-none tracking-[-0.05em] text-[hsl(var(--accent))]">
                {header.logoTop}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.34em] text-muted-foreground">
                {header.logoBottom}
              </span>
            </span>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {footer.description}
            </p>
          </div>
          <div>
            <h4 className="mb-4 text-xs font-semibold tracking-[0.22em] text-muted-foreground">{footer.shopTitle}</h4>
            <div className="flex flex-col gap-2.5">
              {footer.shopLinks.map((item) => (
                <Link key={item.id} to={item.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="mb-4 text-xs font-semibold tracking-[0.22em] text-muted-foreground">{footer.supportTitle}</h4>
            <div className="flex flex-col gap-2.5">
              {footer.supportLinks.map((item) => (
                <Link key={item.id} to={item.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="mb-4 text-xs font-semibold tracking-[0.22em] text-muted-foreground">{footer.aboutTitle}</h4>
            <div className="flex flex-col gap-2.5">
              {footer.aboutLinks.map((item) => (
                <Link key={item.id} to={item.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{footer.copyright}</p>
          <div className="flex items-center gap-4">
            <a href={footer.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground transition-colors hover:text-foreground">Instagram</a>
            <a href={footer.twitterUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground transition-colors hover:text-foreground">Twitter</a>
            <a href={footer.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground transition-colors hover:text-foreground">Facebook</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
