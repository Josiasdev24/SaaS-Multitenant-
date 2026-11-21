import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { q } from "@/lib/data";
import { dateFr } from "@/lib/format";
import { useCurrentUser } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/roles";
import { Logo } from "@/components/logo";
import { getSecretaryCanCollect, setSecretaryCanCollect } from "@/lib/app-settings";
import {
  PageHeader,
  TableWrap,
  Th,
  Td,
  EmptyRow,
  LoadingBlock,
  Panel,
  Section,
  NoAccess,
  Tag,
} from "@/components/kit";

export const Route = createFileRoute("/_authenticated/parametres/")({
  head: () => ({
    meta: [
      { title: "Paramètres" },
      { name: "description", content: "Identité de l'établissement, année scolaire, trimestres, niveaux et seuils d'alerte." },
      { property: "og:title", content: "Paramètres" },
      { property: "og:description", content: "Configurez l'établissement, l'année scolaire et les seuils d'alerte." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const queryClient = useQueryClient();

  const [settings, levels, terms] = useQueries({ queries: [q.settings(), q.levels(), q.terms()] });

  const secretarySetting = useQuery({
    queryKey: ["secretary-can-collect"],
    queryFn: getSecretaryCanCollect,
    enabled: user?.role === "admin",
  });

  const toggleSecretary = useMutation({
    mutationFn: async (value: boolean) => setSecretaryCanCollect(value),
    onSuccess: (_data, value) => {
      toast.success(
        value
          ? "La secrétaire peut désormais encaisser les paiements."
          : "La secrétaire n'a plus accès aux finances.",
      );
      queryClient.invalidateQueries({ queryKey: ["secretary-can-collect"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
    },
    onError: (e: Error) => toast.error("Modification impossible", { description: e.message }),
  });

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      if (!settings.data) throw new Error("Paramètres introuvables.");
      const { error } = await supabase
        .from("schools")
        .update({
          name: String(form.get("name")).trim(),
          short_name: String(form.get("short_name") || "") || null,
          address: String(form.get("address") || "") || null,
          phone: String(form.get("phone") || "") || null,
          email: String(form.get("email") || "") || null,
          currency: String(form.get("currency") || "FCFA"),
          absence_threshold: Number(form.get("absence_threshold")) || 5,
          primary_color: String(form.get("primary_color") || "") || null,
          accent_color: String(form.get("accent_color") || "") || null,
          header_lines: String(form.get("header_lines") || "")
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean),
        } as never)
        .eq("id", settings.data.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Paramètres enregistrés");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
    },
    onError: (e: Error) => toast.error("Enregistrement impossible", { description: e.message }),
  });

  if (!perms) return <LoadingBlock />;
  if (!perms.viewAcademics && !perms.manageStructure) return <NoAccess />;
  if (settings.isPending) return <LoadingBlock />;

  const s = settings.data;
  const secretaryCanCollect = Boolean(secretarySetting.data);

  return (
    <div className="space-y-6 rise">
      <PageHeader
        title="Paramètres"
        subtitle="Identité de l'établissement, structure pédagogique et seuils d'alerte."
      />

      <Panel>
        <h2 className="text-[15px] font-semibold">Établissement</h2>
        <form
          className="mt-4 grid gap-4 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(new FormData(e.currentTarget));
          }}
        >
          <div className="md:col-span-2">
            <label htmlFor="name" className="label-caps">Nom</label>
            <input id="name" name="name" defaultValue={s?.name ?? ""} required disabled={!perms.manageStructure} className={inputClass} />
          </div>
          <div>
            <label htmlFor="short_name" className="label-caps">Sigle</label>
            <input id="short_name" name="short_name" defaultValue={s?.short_name ?? ""} disabled={!perms.manageStructure} className={inputClass} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="address" className="label-caps">Adresse</label>
            <input id="address" name="address" defaultValue={s?.address ?? ""} disabled={!perms.manageStructure} className={inputClass} />
          </div>
          <div>
            <label htmlFor="phone" className="label-caps">Téléphone</label>
            <input id="phone" name="phone" defaultValue={s?.phone ?? ""} disabled={!perms.manageStructure} className={inputClass} />
          </div>
          <div>
            <label htmlFor="email" className="label-caps">Email</label>
            <input id="email" name="email" type="email" defaultValue={s?.email ?? ""} disabled={!perms.manageStructure} className={inputClass} />
          </div>
          <div>
            <label htmlFor="currency" className="label-caps">Devise</label>
            <input id="currency" name="currency" defaultValue={s?.currency ?? "FCFA"} disabled={!perms.manageStructure} className={inputClass} />
          </div>
          <div>
            <label htmlFor="absence_threshold" className="label-caps">Seuil d'alerte absences</label>
            <input
              id="absence_threshold"
              name="absence_threshold"
              type="number"
              min="1"
              defaultValue={s?.absence_threshold ?? 5}
              disabled={!perms.manageStructure}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="primary_color" className="label-caps">Couleur principale</label>
            <input
              id="primary_color"
              name="primary_color"
              type="color"
              defaultValue={s?.primary_color ?? "#2150a0"}
              disabled={!perms.manageStructure}
              className="mt-1.5 h-10 w-full cursor-pointer rounded-md border border-border bg-card p-1"
            />
          </div>
          <div>
            <label htmlFor="accent_color" className="label-caps">Couleur d'accent</label>
            <input
              id="accent_color"
              name="accent_color"
              type="color"
              defaultValue={s?.accent_color ?? "#d6402b"}
              disabled={!perms.manageStructure}
              className="mt-1.5 h-10 w-full cursor-pointer rounded-md border border-border bg-card p-1"
            />
          </div>
          <div className="md:col-span-3">
            <label htmlFor="header_lines" className="label-caps">
              Mentions en tête des bulletins (une par ligne : ministère, direction régionale, numéro d'agrément…)
            </label>
            <textarea
              id="header_lines"
              name="header_lines"
              rows={4}
              defaultValue={(s?.header_lines ?? []).join("\n")}
              disabled={!perms.manageStructure}
              className={inputClass + " h-auto py-2"}
            />
          </div>
          {perms.manageStructure ? (
            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={save.isPending}
                className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {save.isPending ? "Enregistrement…" : "Enregistrer les paramètres"}
              </button>
            </div>
          ) : (
            <p className="md:col-span-3 text-[12px] text-muted-foreground">
              Consultation seule : seuls le fondateur et le directeur peuvent modifier ces paramètres.
            </p>
          )}
        </form>
      </Panel>

      {perms.manageStructure && user?.school ? <LogoPanel schoolId={user.school.id} logoPath={user.school.logo_path} name={user.school.name} /> : null}

      {user?.role === "admin" ? (
        <Panel>
          <h2 className="text-[15px] font-semibold">Accès de la secrétaire</h2>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Par défaut, la secrétaire a accès à tout sauf aux finances. Activez cette option pour
            l'autoriser à encaisser les paiements, enregistrer l'écolage et imprimer les reçus.
          </p>
          <label className="mt-4 flex items-center gap-3 text-[13px] font-medium">
            <input
              type="checkbox"
              checked={secretaryCanCollect}
              disabled={secretarySetting.isPending || toggleSecretary.isPending}
              onChange={(e) => toggleSecretary.mutate(e.target.checked)}
              className="h-4 w-4"
            />
            La secrétaire peut encaisser les paiements
          </label>
        </Panel>
      ) : null}

      <Section title="Trimestres">
        <TableWrap minWidth={480}>
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>Trimestre</Th>
              <Th>Début</Th>
              <Th>Fin</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(terms.data ?? []).length === 0 ? (
              <EmptyRow colSpan={3} label="Aucun trimestre paramétré." />
            ) : (
              (terms.data ?? []).map((t) => (
                <tr key={t.id} className="hover:bg-muted/40">
                  <Td className="font-medium">{t.name}</Td>
                  <Td className="text-muted-foreground">{dateFr(t.start_date)}</Td>
                  <Td className="text-muted-foreground">{dateFr(t.end_date)}</Td>
                </tr>
              ))
            )}
          </tbody>
        </TableWrap>
      </Section>

      <Section title="Niveaux d'enseignement">
        <TableWrap minWidth={420}>
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>Niveau</Th>
              <Th>Cycle</Th>
              <Th className="text-right">Ordre</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(levels.data ?? []).length === 0 ? (
              <EmptyRow colSpan={3} label="Aucun niveau paramétré." />
            ) : (
              (levels.data ?? []).map((l) => (
                <tr key={l.id} className="hover:bg-muted/40">
                  <Td className="font-medium">{l.name}</Td>
                  <Td><Tag>{l.cycle}</Tag></Td>
                  <Td className="num-display text-right text-muted-foreground">{l.order_index}</Td>
                </tr>
              ))
            )}
          </tbody>
        </TableWrap>
      </Section>

      <Section title="Votre compte">
        <Panel>
          <dl className="grid gap-4 text-[13px] md:grid-cols-3">
            <div>
              <dt className="label-caps">Nom</dt>
              <dd className="mt-1 font-medium">{user?.fullName}</dd>
            </div>
            <div>
              <dt className="label-caps">Email</dt>
              <dd className="mt-1 text-muted-foreground">{user?.email}</dd>
            </div>
            <div>
              <dt className="label-caps">Rôle</dt>
              <dd className="mt-1">
                <Tag tone="accent">{user?.role ? ROLE_LABELS[user.role] : "Sans rôle"}</Tag>
              </dd>
            </div>
          </dl>
        </Panel>
      </Section>
    </div>
  );
}

const inputClass =
  "mt-1.5 h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50";


/** Envoi du logo de l'école (stocké dans le dossier de l'école du bucket school-logos). */
function LogoPanel({ schoolId, logoPath, name }: { schoolId: string; logoPath: string | null; name: string }) {
  const queryClient = useQueryClient();
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 2 * 1024 * 1024) throw new Error("Image trop lourde (2 Mo maximum).");
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/jpeg" ? "jpg" : null;
      if (!ext) throw new Error("Format accepté : JPG, PNG ou WebP.");
      const path = `${schoolId}/logo-${Date.now()}.${ext}`;
      const { error: upError } = await supabase.storage.from("school-logos").upload(path, file, { contentType: file.type });
      if (upError) throw new Error(upError.message);
      const { error } = await supabase.from("schools").update({ logo_path: path } as never).eq("id", schoolId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Logo enregistré");
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["school-logo"] });
    },
    onError: (e: Error) => toast.error("Envoi impossible", { description: e.message }),
  });

  return (
    <Panel>
      <h2 className="text-[15px] font-semibold">Logo</h2>
      <div className="mt-3 flex items-center gap-4">
        <Logo className="h-16 w-16 border border-border" name={name} logoPath={logoPath} initialsClassName="text-sm" />
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={upload.isPending}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
          }}
          className="text-[13px]"
        />
      </div>
    </Panel>
  );
}
