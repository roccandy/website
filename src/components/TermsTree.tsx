import type { ManagedTermsNode } from "@/lib/terms-shared";

type Props = {
  items: ManagedTermsNode[];
  depth?: number;
};

function renderBody(body: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => (
      <p key={`${paragraph.slice(0, 24)}-${index}`} className="normal-case leading-relaxed text-zinc-700">
        {paragraph}
      </p>
    ));
}

export default function TermsTree({ items, depth = 0 }: Props) {
  if (items.length === 0) return null;

  if (depth === 0) {
    return (
      <div className="space-y-8">
        {items.map((item) => (
          <section key={item.id} className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
              {item.marker ? `${item.marker} ` : ""}
              {item.title || "Untitled section"}
            </h2>
            {item.body ? <div className="space-y-3 text-sm">{renderBody(item.body)}</div> : null}
            {item.children.length > 0 ? (
              <div className="space-y-3 pl-2">
                <TermsTree items={item.children} depth={depth + 1} />
              </div>
            ) : null}
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="space-y-2">
          <div className="flex items-start gap-3">
            <span className="min-w-[3rem] shrink-0 text-sm font-semibold text-zinc-900">{item.marker}</span>
            <div className="min-w-0 flex-1 space-y-2 text-sm">
              {item.title ? <p className="font-semibold text-zinc-900">{item.title}</p> : null}
              {item.body ? <div className="space-y-2">{renderBody(item.body)}</div> : null}
            </div>
          </div>
          {item.children.length > 0 ? (
            <div className="pl-8">
              <TermsTree items={item.children} depth={depth + 1} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
