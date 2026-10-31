"use client";

import { attachmentLink } from "@/server/actions";

export function FileLink({ path, name }: { path: string; name: string }) {
  return (
    <button
      type="button"
      className="text-sm font-semibold text-teal underline"
      onClick={async () => {
        const url = await attachmentLink(path);
        if (url) window.location.href = url;
      }}
    >
      {name}
    </button>
  );
}
