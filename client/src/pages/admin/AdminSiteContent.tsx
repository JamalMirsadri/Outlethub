import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Plus, Save, Search, Trash2 } from "lucide-react";

import {
  getAdminSiteContentSettings,
  updateAdminSiteContentSettings,
} from "@/api/commerce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import {
  cloneSiteContentSettings,
  DEFAULT_SITE_CONTENT_SETTINGS,
  type FooterLinkContent,
  type HeroSlideContent,
  type HeroStatContent,
  type SiteContentSettings,
  type TrustBadgeContent,
} from "@/lib/site-content";

function createSlide(index: number): HeroSlideContent {
  return {
    id: `slide-${Date.now()}-${index}`,
    eyebrow: "New Slide",
    titleTop: "Hero Title",
    titleAccent: "Accent Title",
    description: "Describe this hero slide here.",
    primaryLabel: "Primary CTA",
    primaryHref: "/shop",
    secondaryLabel: "Secondary CTA",
    secondaryHref: "/shop?sort=newest",
    imageUrl: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1600&q=80",
    overlayFrom: "rgba(14,18,26,0.72)",
    overlayVia: "rgba(14,18,26,0.35)",
    overlayTo: "rgba(14,18,26,0.10)",
    cardEyebrow: "Card Eyebrow",
    cardTitle: "Card Title",
    cardDescription: "Card supporting text.",
  };
}

function createBadge(index: number): TrustBadgeContent {
  return {
    id: `badge-${Date.now()}-${index}`,
    icon: "truck",
    title: "New Badge",
    description: "Badge description",
  };
}

function createStat(index: number): HeroStatContent {
  return {
    id: `stat-${Date.now()}-${index}`,
    label: "New Stat",
    value: 100,
    suffix: "+",
  };
}

function createFooterLink(section: string, index: number): FooterLinkContent {
  return {
    id: `${section}-link-${Date.now()}-${index}`,
    label: "New Link",
    href: "/",
  };
}

type FooterLinkKey = "shopLinks" | "supportLinks" | "aboutLinks";

export default function AdminSiteContent() {
  const [form, setForm] = useState<SiteContentSettings>(cloneSiteContentSettings(DEFAULT_SITE_CONTENT_SETTINGS));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const settings = await getAdminSiteContentSettings();
    setForm(cloneSiteContentSettings(settings));
  };

  useEffect(() => {
    load()
      .catch((error) => {
        toast({
          title: "Content settings failed to load",
          description: error instanceof Error ? error.message : "Please refresh the page.",
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await updateAdminSiteContentSettings(form);
      setForm(cloneSiteContentSettings(saved));
      toast({
        title: "Site content saved",
        description: "Homepage content, slideshow images, and SEO settings were updated.",
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const heroSlides = useMemo(() => form.heroSlides, [form.heroSlides]);
  const heroStats = useMemo(() => form.heroStats, [form.heroStats]);
  const trustBadges = useMemo(() => form.trustBadges, [form.trustBadges]);

  const updateFooterLink = (
    section: FooterLinkKey,
    linkId: string,
    field: keyof FooterLinkContent,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      footer: {
        ...current.footer,
        [section]: current.footer[section].map((item) =>
          item.id === linkId ? { ...item, [field]: value } : item,
        ),
      },
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Site Content & SEO</h1>
          <p className="mt-2 text-sm text-muted-foreground">Loading storefront content settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Site Content & SEO</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage storefront text, homepage sections, hero slideshow images, and global SEO from one admin screen.
          </p>
        </div>
        <Button onClick={() => void save()} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Content"}
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold">Global Store Text</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Label className="text-xs">Site Name</Label>
            <Input className="mt-1" value={form.siteName} onChange={(event) => setForm((current) => ({ ...current, siteName: event.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Site Tagline</Label>
            <Input className="mt-1" value={form.siteTagline} onChange={(event) => setForm((current) => ({ ...current, siteTagline: event.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Header Logo Top</Label>
            <Input className="mt-1" value={form.header.logoTop} onChange={(event) => setForm((current) => ({ ...current, header: { ...current.header, logoTop: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Header Logo Bottom</Label>
            <Input className="mt-1" value={form.header.logoBottom} onChange={(event) => setForm((current) => ({ ...current, header: { ...current.header, logoBottom: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Shop Label</Label>
            <Input className="mt-1" value={form.header.shopLabel} onChange={(event) => setForm((current) => ({ ...current, header: { ...current.header, shopLabel: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Account Label</Label>
            <Input className="mt-1" value={form.header.accountLabel} onChange={(event) => setForm((current) => ({ ...current, header: { ...current.header, accountLabel: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Cart Label</Label>
            <Input className="mt-1" value={form.header.cartLabel} onChange={(event) => setForm((current) => ({ ...current, header: { ...current.header, cartLabel: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Header Wishlist Label</Label>
            <Input className="mt-1" value={form.header.wishlistLabel} onChange={(event) => setForm((current) => ({ ...current, header: { ...current.header, wishlistLabel: event.target.value } }))} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Announcement Bar</p>
              <p className="text-xs text-muted-foreground">Show or hide the small bar at the top of the storefront.</p>
            </div>
            <Switch checked={form.announcementBar.enabled} onCheckedChange={(checked) => setForm((current) => ({ ...current, announcementBar: { ...current.announcementBar, enabled: checked } }))} />
          </div>
          <div>
            <Label className="text-xs">Header Search Placeholder</Label>
            <Input className="mt-1" value={form.header.searchPlaceholder} onChange={(event) => setForm((current) => ({ ...current, header: { ...current.header, searchPlaceholder: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Announcement Left Text</Label>
            <Input className="mt-1" value={form.announcementBar.leftText} onChange={(event) => setForm((current) => ({ ...current, announcementBar: { ...current.announcementBar, leftText: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Announcement Right Text</Label>
            <Input className="mt-1" value={form.announcementBar.rightText} onChange={(event) => setForm((current) => ({ ...current, announcementBar: { ...current.announcementBar, rightText: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Sign In Label</Label>
            <Input className="mt-1" value={form.announcementBar.signInLabel} onChange={(event) => setForm((current) => ({ ...current, announcementBar: { ...current.announcementBar, signInLabel: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Wishlist Label</Label>
            <Input className="mt-1" value={form.announcementBar.wishlistLabel} onChange={(event) => setForm((current) => ({ ...current, announcementBar: { ...current.announcementBar, wishlistLabel: event.target.value } }))} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Homepage Hero Slideshow</h2>
            <p className="mt-1 text-sm text-muted-foreground">Edit all hero slide text, buttons, overlay colors, and image URLs.</p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() =>
              setForm((current) => ({
                ...current,
                heroSlides: [...current.heroSlides, createSlide(current.heroSlides.length + 1)],
              }))
            }
          >
            <Plus className="h-4 w-4" />
            Add Slide
          </Button>
        </div>

        <div className="mt-6 space-y-6">
          {heroSlides.map((slide, index) => (
            <div key={slide.id} className="rounded-xl border border-border p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium">Slide {index + 1}</h3>
                </div>
                {heroSlides.length > 1 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-destructive"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        heroSlides: current.heroSlides.filter((item) => item.id !== slide.id),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Eyebrow</Label>
                  <Input className="mt-1" value={slide.eyebrow} onChange={(event) => setForm((current) => ({ ...current, heroSlides: current.heroSlides.map((item) => item.id === slide.id ? { ...item, eyebrow: event.target.value } : item) }))} />
                </div>
                <div>
                  <Label className="text-xs">Image URL</Label>
                  <Input className="mt-1" value={slide.imageUrl} onChange={(event) => setForm((current) => ({ ...current, heroSlides: current.heroSlides.map((item) => item.id === slide.id ? { ...item, imageUrl: event.target.value } : item) }))} />
                </div>
                <div>
                  <Label className="text-xs">Title Top</Label>
                  <Input className="mt-1" value={slide.titleTop} onChange={(event) => setForm((current) => ({ ...current, heroSlides: current.heroSlides.map((item) => item.id === slide.id ? { ...item, titleTop: event.target.value } : item) }))} />
                </div>
                <div>
                  <Label className="text-xs">Title Accent</Label>
                  <Input className="mt-1" value={slide.titleAccent} onChange={(event) => setForm((current) => ({ ...current, heroSlides: current.heroSlides.map((item) => item.id === slide.id ? { ...item, titleAccent: event.target.value } : item) }))} />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Description</Label>
                  <Textarea className="mt-1" rows={3} value={slide.description} onChange={(event) => setForm((current) => ({ ...current, heroSlides: current.heroSlides.map((item) => item.id === slide.id ? { ...item, description: event.target.value } : item) }))} />
                </div>
                <div>
                  <Label className="text-xs">Primary Button Label</Label>
                  <Input className="mt-1" value={slide.primaryLabel} onChange={(event) => setForm((current) => ({ ...current, heroSlides: current.heroSlides.map((item) => item.id === slide.id ? { ...item, primaryLabel: event.target.value } : item) }))} />
                </div>
                <div>
                  <Label className="text-xs">Primary Button Link</Label>
                  <Input className="mt-1" value={slide.primaryHref} onChange={(event) => setForm((current) => ({ ...current, heroSlides: current.heroSlides.map((item) => item.id === slide.id ? { ...item, primaryHref: event.target.value } : item) }))} />
                </div>
                <div>
                  <Label className="text-xs">Secondary Button Label</Label>
                  <Input className="mt-1" value={slide.secondaryLabel} onChange={(event) => setForm((current) => ({ ...current, heroSlides: current.heroSlides.map((item) => item.id === slide.id ? { ...item, secondaryLabel: event.target.value } : item) }))} />
                </div>
                <div>
                  <Label className="text-xs">Secondary Button Link</Label>
                  <Input className="mt-1" value={slide.secondaryHref} onChange={(event) => setForm((current) => ({ ...current, heroSlides: current.heroSlides.map((item) => item.id === slide.id ? { ...item, secondaryHref: event.target.value } : item) }))} />
                </div>
                <div>
                  <Label className="text-xs">Overlay From</Label>
                  <Input className="mt-1" value={slide.overlayFrom} onChange={(event) => setForm((current) => ({ ...current, heroSlides: current.heroSlides.map((item) => item.id === slide.id ? { ...item, overlayFrom: event.target.value } : item) }))} />
                </div>
                <div>
                  <Label className="text-xs">Overlay Via</Label>
                  <Input className="mt-1" value={slide.overlayVia} onChange={(event) => setForm((current) => ({ ...current, heroSlides: current.heroSlides.map((item) => item.id === slide.id ? { ...item, overlayVia: event.target.value } : item) }))} />
                </div>
                <div>
                  <Label className="text-xs">Overlay To</Label>
                  <Input className="mt-1" value={slide.overlayTo} onChange={(event) => setForm((current) => ({ ...current, heroSlides: current.heroSlides.map((item) => item.id === slide.id ? { ...item, overlayTo: event.target.value } : item) }))} />
                </div>
                <div>
                  <Label className="text-xs">Card Eyebrow</Label>
                  <Input className="mt-1" value={slide.cardEyebrow} onChange={(event) => setForm((current) => ({ ...current, heroSlides: current.heroSlides.map((item) => item.id === slide.id ? { ...item, cardEyebrow: event.target.value } : item) }))} />
                </div>
                <div>
                  <Label className="text-xs">Card Title</Label>
                  <Input className="mt-1" value={slide.cardTitle} onChange={(event) => setForm((current) => ({ ...current, heroSlides: current.heroSlides.map((item) => item.id === slide.id ? { ...item, cardTitle: event.target.value } : item) }))} />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Card Description</Label>
                  <Textarea className="mt-1" rows={2} value={slide.cardDescription} onChange={(event) => setForm((current) => ({ ...current, heroSlides: current.heroSlides.map((item) => item.id === slide.id ? { ...item, cardDescription: event.target.value } : item) }))} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold">Homepage Sections</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Label className="text-xs">New Arrivals Title</Label>
            <Input className="mt-1" value={form.homeSections.newArrivalsTitle} onChange={(event) => setForm((current) => ({ ...current, homeSections: { ...current.homeSections, newArrivalsTitle: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">New Arrivals CTA Label</Label>
            <Input className="mt-1" value={form.homeSections.newArrivalsCtaLabel} onChange={(event) => setForm((current) => ({ ...current, homeSections: { ...current.homeSections, newArrivalsCtaLabel: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">New Arrivals CTA Link</Label>
            <Input className="mt-1" value={form.homeSections.newArrivalsCtaHref} onChange={(event) => setForm((current) => ({ ...current, homeSections: { ...current.homeSections, newArrivalsCtaHref: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Categories Title</Label>
            <Input className="mt-1" value={form.homeSections.categoriesTitle} onChange={(event) => setForm((current) => ({ ...current, homeSections: { ...current.homeSections, categoriesTitle: event.target.value } }))} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Promo Banner Title</Label>
            <Input className="mt-1" value={form.homeSections.promoTitle} onChange={(event) => setForm((current) => ({ ...current, homeSections: { ...current.homeSections, promoTitle: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Promo Button Label</Label>
            <Input className="mt-1" value={form.homeSections.promoButtonLabel} onChange={(event) => setForm((current) => ({ ...current, homeSections: { ...current.homeSections, promoButtonLabel: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Promo Button Link</Label>
            <Input className="mt-1" value={form.homeSections.promoButtonHref} onChange={(event) => setForm((current) => ({ ...current, homeSections: { ...current.homeSections, promoButtonHref: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Best Sellers Title</Label>
            <Input className="mt-1" value={form.homeSections.bestSellersTitle} onChange={(event) => setForm((current) => ({ ...current, homeSections: { ...current.homeSections, bestSellersTitle: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Best Sellers CTA Label</Label>
            <Input className="mt-1" value={form.homeSections.bestSellersCtaLabel} onChange={(event) => setForm((current) => ({ ...current, homeSections: { ...current.homeSections, bestSellersCtaLabel: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Best Sellers CTA Link</Label>
            <Input className="mt-1" value={form.homeSections.bestSellersCtaHref} onChange={(event) => setForm((current) => ({ ...current, homeSections: { ...current.homeSections, bestSellersCtaHref: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Trust Badges Title</Label>
            <Input className="mt-1" value={form.homeSections.trustBadgesTitle} onChange={(event) => setForm((current) => ({ ...current, homeSections: { ...current.homeSections, trustBadgesTitle: event.target.value } }))} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Brand Marquee (one brand per line)</Label>
            <Textarea
              className="mt-1"
              rows={4}
              value={form.brandMarquee.join("\n")}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  brandMarquee: event.target.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean),
                }))
              }
            />
          </div>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Hero Stats</h3>
              <p className="mt-1 text-sm text-muted-foreground">Edit the number cards shown below the homepage slideshow.</p>
            </div>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  heroStats: [...current.heroStats, createStat(current.heroStats.length + 1)],
                }))
              }
            >
              <Plus className="h-4 w-4" />
              Add Stat
            </Button>
          </div>

          <div className="mt-4 space-y-4">
            {heroStats.map((stat) => (
              <div key={stat.id} className="grid gap-4 rounded-xl border border-border p-4 md:grid-cols-[1fr_180px_140px_auto]">
                <div>
                  <Label className="text-xs">Label</Label>
                  <Input
                    className="mt-1"
                    value={stat.label}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        heroStats: current.heroStats.map((item) =>
                          item.id === stat.id ? { ...item, label: event.target.value } : item,
                        ),
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Value</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min="0"
                    value={stat.value}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        heroStats: current.heroStats.map((item) =>
                          item.id === stat.id ? { ...item, value: Number(event.target.value) || 0 } : item,
                        ),
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Suffix</Label>
                  <Input
                    className="mt-1"
                    value={stat.suffix}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        heroStats: current.heroStats.map((item) =>
                          item.id === stat.id ? { ...item, suffix: event.target.value } : item,
                        ),
                      }))
                    }
                  />
                </div>
                <div className="flex items-end">
                  {heroStats.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-destructive"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          heroStats: current.heroStats.filter((item) => item.id !== stat.id),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Trust Badges</h2>
            <p className="mt-1 text-sm text-muted-foreground">Edit the homepage trust badges and choose which icon each badge uses.</p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setForm((current) => ({ ...current, trustBadges: [...current.trustBadges, createBadge(current.trustBadges.length + 1)] }))}
          >
            <Plus className="h-4 w-4" />
            Add Badge
          </Button>
        </div>

        <div className="mt-6 space-y-4">
          {trustBadges.map((badge) => (
            <div key={badge.id} className="grid gap-4 rounded-xl border border-border p-4 md:grid-cols-[1fr_1fr_220px_auto]">
              <div>
                <Label className="text-xs">Title</Label>
                <Input className="mt-1" value={badge.title} onChange={(event) => setForm((current) => ({ ...current, trustBadges: current.trustBadges.map((item) => item.id === badge.id ? { ...item, title: event.target.value } : item) }))} />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Input className="mt-1" value={badge.description} onChange={(event) => setForm((current) => ({ ...current, trustBadges: current.trustBadges.map((item) => item.id === badge.id ? { ...item, description: event.target.value } : item) }))} />
              </div>
              <div>
                <Label className="text-xs">Icon</Label>
                <Select value={badge.icon} onValueChange={(value) => setForm((current) => ({ ...current, trustBadges: current.trustBadges.map((item) => item.id === badge.id ? { ...item, icon: value as TrustBadgeContent["icon"] } : item) }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="truck">Truck</SelectItem>
                    <SelectItem value="shield">Shield</SelectItem>
                    <SelectItem value="return">Return</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                {trustBadges.length > 1 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-destructive"
                    onClick={() => setForm((current) => ({ ...current, trustBadges: current.trustBadges.filter((item) => item.id !== badge.id) }))}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold">Footer Content</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Label className="text-xs">Newsletter Eyebrow</Label>
            <Input className="mt-1" value={form.footer.newsletterEyebrow} onChange={(event) => setForm((current) => ({ ...current, footer: { ...current.footer, newsletterEyebrow: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Newsletter Button Label</Label>
            <Input className="mt-1" value={form.footer.newsletterButtonLabel} onChange={(event) => setForm((current) => ({ ...current, footer: { ...current.footer, newsletterButtonLabel: event.target.value } }))} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Newsletter Title</Label>
            <Textarea className="mt-1" rows={2} value={form.footer.newsletterTitle} onChange={(event) => setForm((current) => ({ ...current, footer: { ...current.footer, newsletterTitle: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Newsletter Placeholder</Label>
            <Input className="mt-1" value={form.footer.newsletterPlaceholder} onChange={(event) => setForm((current) => ({ ...current, footer: { ...current.footer, newsletterPlaceholder: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Footer Description</Label>
            <Textarea className="mt-1" rows={2} value={form.footer.description} onChange={(event) => setForm((current) => ({ ...current, footer: { ...current.footer, description: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Shop Column Title</Label>
            <Input className="mt-1" value={form.footer.shopTitle} onChange={(event) => setForm((current) => ({ ...current, footer: { ...current.footer, shopTitle: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Support Column Title</Label>
            <Input className="mt-1" value={form.footer.supportTitle} onChange={(event) => setForm((current) => ({ ...current, footer: { ...current.footer, supportTitle: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">About Column Title</Label>
            <Input className="mt-1" value={form.footer.aboutTitle} onChange={(event) => setForm((current) => ({ ...current, footer: { ...current.footer, aboutTitle: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Copyright</Label>
            <Input className="mt-1" value={form.footer.copyright} onChange={(event) => setForm((current) => ({ ...current, footer: { ...current.footer, copyright: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Instagram URL</Label>
            <Input className="mt-1" value={form.footer.instagramUrl} onChange={(event) => setForm((current) => ({ ...current, footer: { ...current.footer, instagramUrl: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Twitter URL</Label>
            <Input className="mt-1" value={form.footer.twitterUrl} onChange={(event) => setForm((current) => ({ ...current, footer: { ...current.footer, twitterUrl: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Facebook URL</Label>
            <Input className="mt-1" value={form.footer.facebookUrl} onChange={(event) => setForm((current) => ({ ...current, footer: { ...current.footer, facebookUrl: event.target.value } }))} />
          </div>
        </div>

        <div className="mt-8 space-y-8">
          {([
            { key: "shopLinks", title: "Shop Links" },
            { key: "supportLinks", title: "Support Links" },
            { key: "aboutLinks", title: "About Links" },
          ] as const).map((section) => (
            <div key={section.key}>
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{section.title}</h3>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      footer: {
                        ...current.footer,
                        [section.key]: [
                          ...current.footer[section.key],
                          createFooterLink(section.key, current.footer[section.key].length + 1),
                        ],
                      },
                    }))
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add Link
                </Button>
              </div>

              <div className="mt-4 space-y-4">
                {form.footer[section.key].map((link) => (
                  <div key={link.id} className="grid gap-4 rounded-xl border border-border p-4 md:grid-cols-[1fr_1.5fr_auto]">
                    <div>
                      <Label className="text-xs">Label</Label>
                      <Input
                        className="mt-1"
                        value={link.label}
                        onChange={(event) =>
                          updateFooterLink(section.key, link.id, "label", event.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Link</Label>
                      <Input
                        className="mt-1"
                        value={link.href}
                        onChange={(event) =>
                          updateFooterLink(section.key, link.id, "href", event.target.value)
                        }
                      />
                    </div>
                    <div className="flex items-end">
                      {form.footer[section.key].length > 1 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2 text-destructive"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              footer: {
                                ...current.footer,
                                [section.key]: current.footer[section.key].filter(
                                  (item) => item.id !== link.id,
                                ),
                              },
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">SEO Settings</h2>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Label className="text-xs">Default Title</Label>
            <Input className="mt-1" value={form.seo.defaultTitle} onChange={(event) => setForm((current) => ({ ...current, seo: { ...current.seo, defaultTitle: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Title Suffix</Label>
            <Input className="mt-1" value={form.seo.titleSuffix} onChange={(event) => setForm((current) => ({ ...current, seo: { ...current.seo, titleSuffix: event.target.value } }))} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Meta Description</Label>
            <Textarea className="mt-1" rows={3} value={form.seo.description} onChange={(event) => setForm((current) => ({ ...current, seo: { ...current.seo, description: event.target.value } }))} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Keywords</Label>
            <Textarea className="mt-1" rows={2} value={form.seo.keywords} onChange={(event) => setForm((current) => ({ ...current, seo: { ...current.seo, keywords: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">OG Image URL</Label>
            <Input className="mt-1" value={form.seo.ogImageUrl} onChange={(event) => setForm((current) => ({ ...current, seo: { ...current.seo, ogImageUrl: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Canonical Base URL</Label>
            <Input className="mt-1" value={form.seo.canonicalBaseUrl} onChange={(event) => setForm((current) => ({ ...current, seo: { ...current.seo, canonicalBaseUrl: event.target.value } }))} />
          </div>
          <div>
            <Label className="text-xs">Robots</Label>
            <Input className="mt-1" value={form.seo.robots} onChange={(event) => setForm((current) => ({ ...current, seo: { ...current.seo, robots: event.target.value } }))} />
          </div>
        </div>
      </div>
    </div>
  );
}
