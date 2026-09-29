"use client";

import { site } from "@/config/site";
import { useState } from "react";
import Link from "next/link";
import { Flag, MapPin, Settings } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { FollowButton } from "./follow-button";
import { ShareButton } from "./share-button";
import { MoreMenu } from "./more-menu";
import { useReport } from "./report-dialog";
import { formatNumber } from "@/lib/text";
import type { ProfileData } from "@/lib/types";

export function ProfileHeader({ profile }: { profile: ProfileData }) {
  const [followers, setFollowers] = useState(profile.followerCount);
  const report = useReport();

  const stats = [
    { label: "Publicaciones", value: profile.postCount },
    { label: "Seguidores", value: followers, href: `/u/${profile.username}/followers` },
    { label: "Siguiendo", value: profile.followingCount, href: `/u/${profile.username}/following` },
    { label: "Fiestas", value: profile.eventCount },
  ];

  return (
    <header className="space-y-5">
      <div className="flex items-center gap-5">
        <div className="rounded-full bg-gradient-to-tr from-volt via-volt/40 to-transparent p-[3px]">
          <Avatar user={profile} size={92} className="ring-4 ring-ink" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[26px] leading-tight font-bold uppercase">{profile.displayName}</h1>
          <p className="flex items-center gap-2 text-muted">
            @{profile.username}
          </p>
          {profile.viewer.followsYou && !profile.viewer.isSelf && <p className="mt-1 text-[12px] font-semibold text-volt">Te sigue</p>}
        </div>
      </div>

      {profile.bio && <p className="text-[15px] whitespace-pre-line">“{profile.bio}”</p>}
      {profile.city && (
        <p className="flex items-center gap-1 text-[13px] text-muted">
          <MapPin className="size-3.5" /> {profile.city.name}
        </p>
      )}

      <dl className="grid grid-cols-4 gap-2 text-center">
        {stats.map((s) => {
          const content = (
            <>
              <dd className="font-display text-lg font-bold">{formatNumber(s.value)}</dd>
              <dt className="text-[11px] text-muted">{s.label}</dt>
            </>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="flex flex-col-reverse rounded-2xl py-2 hover:bg-surface">
              {content}
            </Link>
          ) : (
            <div key={s.label} className="flex flex-col-reverse py-2">
              {content}
            </div>
          );
        })}
      </dl>

      <div className="flex gap-2">
        {profile.viewer.isSelf ? (
          <Link href="/settings" className={buttonClass("secondary", "md", "flex-1")}>
            <Settings className="size-4" /> Editar perfil
          </Link>
        ) : (
          <FollowButton targetId={profile.id} initial={profile.viewer.following} onChange={(_, c) => c != null && setFollowers(c)} className="flex-1" />
        )}
        <ShareButton url={`/u/${profile.username}`} title={`${profile.displayName} en ${site.name}`} iconOnly className="size-10 rounded-full border border-line-strong hover:bg-surface-2" />
        {!profile.viewer.isSelf && <MoreMenu items={[{ label: "Reportar usuario", icon: <Flag className="size-4" />, onSelect: () => report.open("USER", profile.id) }]} className="border border-line-strong" />}
      </div>
      {report.dialog}
    </header>
  );
}
