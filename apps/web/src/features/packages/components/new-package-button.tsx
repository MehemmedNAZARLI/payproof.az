"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCan } from "@/features/auth";
import { NewPackageDialog } from "./new-package-dialog";

/** Header action; shown only to roles that may upload (the server checks again). */
export function NewPackageButton() {
  const [open, setOpen] = useState(false);
  if (!useCan("EDIT_PACKAGE")) return null;
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Yeni paket
      </Button>
      {open && <NewPackageDialog open onOpenChange={setOpen} />}
    </>
  );
}
