"use client";

import { useState } from "react";
import { ui } from "@/lib/ui";

type DeleteButtonProps = {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  label?: string;
  confirmMessage?: string;
};

export function DeleteButton({
  action,
  id,
  label = "Supprimer",
  confirmMessage = "Confirmer la suppression ? Cette action est irréversible.",
}: DeleteButtonProps) {
  const [pending, setPending] = useState(false);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
          return;
        }
        setPending(true);
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className={ui.dangerButton}>
        {pending ? "Suppression…" : label}
      </button>
    </form>
  );
}
