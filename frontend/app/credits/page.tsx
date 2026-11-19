import type { Metadata } from "next";
import { STORES } from "@/lib/catalog";
import { T } from "@/lib/i18n";
import BackButton from "@/components/BackButton";

export const metadata: Metadata = { title: "Credits" };

const LICENSE_URLS: Record<string, string> = {
  "CC BY 2.0": "https://creativecommons.org/licenses/by/2.0/",
  "CC BY-SA 3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
  "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  "CC0": "https://creativecommons.org/publicdomain/zero/1.0/",
};

/** Attribution for every photo and outside resource the site uses. */
export default function CreditsPage() {
  const photos = STORES.filter((s) => s.photo);
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <BackButton href="/" />
      <h1 className="text-3xl font-bold"><T k="credits.title" /></h1>
      <p className="mt-1 text-muted"><T k="credits.text" /></p>

      <section className="card mt-6 p-5">
        <h2 className="text-lg font-bold"><T k="credits.photos" /></h2>
        <ul className="mt-3 divide-y divide-border text-sm">
          {photos.map((s) => (
            <li key={s.id} className="py-3">
              <p className="font-semibold">{s.name}</p>
              <p className="text-muted">
                “<a href={s.photo!.source} target="_blank" rel="noopener noreferrer" className="text-brand underline">{s.photo!.source.includes("File:") ? decodeURIComponent(s.photo!.source.split("File:")[1]).replaceAll("_", " ") : <T k="credits.photo" />}</a>”
                {" "}<T k="credits.by" /> {s.photo!.author},{" "}
                <a href={LICENSE_URLS[s.photo!.license] ?? s.photo!.source} target="_blank" rel="noopener noreferrer" className="underline">{s.photo!.license}</a>
                {" "}· <T k="credits.resized" />
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card mt-4 p-5 text-sm">
        <h2 className="text-lg font-bold"><T k="credits.other" /></h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-muted">
          <li><T k="credits.map" /> <a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer" className="underline">Leaflet</a> · <T k="credits.mapData" /> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a> <T k="credits.contributors" /> · <T k="credits.backupTiles" /> <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer" className="underline">CARTO</a></li>
          <li><T k="credits.icons" /> <a href="https://simpleicons.org" target="_blank" rel="noopener noreferrer" className="underline">Simple Icons</a> (CC0)</li>
          <li><T k="credits.fonts" /></li>
        </ul>
      </section>
    </div>
  );
}
