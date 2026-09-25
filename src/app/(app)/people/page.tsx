import type { Metadata } from "next";
import { getSessionUser } from "@/server/auth/session";
import { getCurrentCity } from "@/server/services/cities";
import { suggestedUsers } from "@/server/services/users";
import { UserRow } from "@/components/social/user-row";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Descubrir gente" };

export default async function PeoplePage() {
  const [user, city] = await Promise.all([getSessionUser(), getCurrentCity()]);
  const people = await suggestedUsers(user?.id, city.id, 40);
  return (
    <div className="mx-auto max-w-xl px-4 pt-6 md:pt-10">
      <h1 className="font-display text-[28px] font-bold">Gente de la noche</h1>
      <p className="mb-5 text-muted">Sigue a quien sale por {city.name} para ver sus planes y publicaciones.</p>
      {people.length ? (
        <div className="divide-y divide-line">
          {people.map((p) => <UserRow key={p.id} user={p} following={false} showFollow={p.id !== user?.id} />)}
        </div>
      ) : (
        <EmptyState title="Ya sigues a todo el mundo 🙌" />
      )}
    </div>
  );
}
