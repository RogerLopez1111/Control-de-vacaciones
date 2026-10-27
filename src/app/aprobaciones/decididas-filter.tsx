"use client";

import { useRouter } from "next/navigation";

interface EmpOption {
  id: number;
  name: string;
}

export function DecididasFilter({
  options,
  selected,
}: {
  options: EmpOption[];
  selected: string;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="emp-filter" className="text-sm text-brand-gray">
        Empleado:
      </label>
      <select
        id="emp-filter"
        value={selected}
        onChange={(e) => {
          const val = e.target.value;
          const params = new URLSearchParams({ tab: "decididas" });
          if (val) params.set("emp", val);
          router.push(`/aprobaciones?${params.toString()}`);
        }}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-brand-navy focus:border-brand-navy focus:outline-none"
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}
