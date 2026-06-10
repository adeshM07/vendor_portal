import { Building2, Mail, Phone, User, Link2, Link2Off } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { VendorProfile } from "@/lib/vendor";

interface VendorProfileCardProps {
  profile: VendorProfile;
  displayPhone: string;
}

export function VendorProfileCard({ profile, displayPhone }: VendorProfileCardProps) {
  const displayName =
    profile.name ?? profile.contact_name ?? "Vendor Account";
  const contactPerson = profile.contact_name;
  const phone = profile.phone ?? displayPhone;
  const email = profile.email;

  return (
    <Card className="overflow-hidden">
      <div className="relative px-6 py-5">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-500/[0.06] via-transparent to-emerald-500/[0.04]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-zinc-700/80 bg-zinc-900/80 text-blue-400 shadow-inner">
              <Building2 className="h-7 w-7" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-50">
                  {displayName}
                </h2>
                {profile.is_linked ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-400">
                    <Link2 className="h-3 w-3" />
                    Linked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-400">
                    <Link2Off className="h-3 w-3" />
                    Pending link
                  </span>
                )}
              </div>
              {contactPerson && profile.name && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-400">
                  <User className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {contactPerson}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" strokeWidth={1.5} />
                  +91 {phone}
                </span>
                {email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {email}
                  </span>
                )}
              </div>
            </div>
          </div>
          {!profile.is_linked && (
            <p className="max-w-xs rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-200/80">
              Accept your first booking to link this account to your vendor profile.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
